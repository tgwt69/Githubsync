import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CloudUpload, FolderOpen, Upload, GitBranch, Folder } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import JSZip from "jszip";
import type { GitHubRepository } from "@shared/schema";

interface FileUploadPanelProps {
  selectedRepo: GitHubRepository | null;
  selectedBranch: string;
}

interface UploadFile {
  file: File;
  path: string;
  progress: number;
}

export default function FileUploadPanel({ selectedRepo, selectedBranch }: FileUploadPanelProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [extractZip, setExtractZip] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (files: UploadFile[]) => {
      if (!selectedRepo) throw new Error("No repository selected");

      // Prepare files for batch upload
      const filePayloads = [];
      for (const uploadFile of files) {
        const content = await fileToBase64(uploadFile.file);
        filePayloads.push({
          path: uploadFile.path,
          content: content.split(',')[1], // Remove data:... prefix
        });
        
        // Update progress
        setUploadFiles(prev => 
          prev.map(f => 
            f.path === uploadFile.path 
              ? { ...f, progress: 50 }
              : f
          )
        );
      }

      // Use batch upload API
      const response = await apiRequest(
        "POST",
        `/api/repositories/${selectedRepo.full_name}/upload-batch`,
        {
          files: filePayloads,
          message: `Upload ${files.length} file${files.length > 1 ? 's' : ''}`,
          branch: selectedBranch,
        }
      );

      const result = await response.json();
      
      // Update progress for all files
      setUploadFiles(prev => 
        prev.map(f => ({ ...f, progress: 100 }))
      );
      
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Files uploaded successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/repositories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
      setUploadFiles([]);
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    const newFiles: UploadFile[] = Array.from(files).map(file => ({
      file,
      path: (file as any).webkitRelativePath || file.name,
      progress: 0,
    }));

    setUploadFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleFolderSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const items = Array.from(e.dataTransfer.items);
    const droppedFiles: File[] = [];
    const filePromises: Promise<void>[] = [];

    // Handle both files and directories
    items.forEach((item) => {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          if (entry.isFile) {
            const file = item.getAsFile();
            if (file) droppedFiles.push(file);
          } else if (entry.isDirectory) {
            filePromises.push(
              new Promise((resolve) => {
                readDirectory(entry as FileSystemDirectoryEntry, '', (files) => {
                  droppedFiles.push(...files);
                  resolve();
                });
              })
            );
          }
        }
      }
    });

    if (filePromises.length > 0) {
      Promise.all(filePromises).then(() => {
        const fileList = new DataTransfer();
        droppedFiles.forEach(file => fileList.items.add(file));
        handleFileSelect(fileList.files);
      });
    } else {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  // Helper function to read directory recursively
  const readDirectory = (
    dirEntry: FileSystemDirectoryEntry, 
    path: string, 
    callback: (files: File[]) => void
  ) => {
    const files: File[] = [];
    const dirReader = dirEntry.createReader();
    
    const readEntries = () => {
      dirReader.readEntries((entries) => {
        if (entries.length === 0) {
          callback(files);
          return;
        }
        
        let pending = entries.length;
        entries.forEach((entry) => {
          if (entry.isFile) {
            (entry as FileSystemFileEntry).file((file) => {
              // Create a new file with the full path
              const newFile = new File([file], file.name, { type: file.type });
              Object.defineProperty(newFile, 'webkitRelativePath', {
                value: path ? `${path}/${file.name}` : file.name,
                writable: false
              });
              files.push(newFile);
              if (--pending === 0) readEntries();
            });
          } else if (entry.isDirectory) {
            readDirectory(
              entry as FileSystemDirectoryEntry, 
              path ? `${path}/${entry.name}` : entry.name,
              (subFiles) => {
                files.push(...subFiles);
                if (--pending === 0) readEntries();
              }
            );
          }
        });
      });
    };
    
    readEntries();
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (extractZip && file.name.endsWith('.zip')) {
      try {
        toast({
          title: "Extracting ZIP",
          description: "Processing ZIP file contents...",
        });

        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);
        const extractedFiles: UploadFile[] = [];

        for (const [relativePath, zipEntry] of Object.entries(zipContent.files)) {
          if (!zipEntry.dir) {
            const arrayBuffer = await zipEntry.async('arraybuffer');
            const blob = new Blob([arrayBuffer]);
            const extractedFile = new File([blob], zipEntry.name, {
              type: 'application/octet-stream'
            });

            extractedFiles.push({
              file: extractedFile,
              path: relativePath,
              progress: 0,
            });
          }
        }

        setUploadFiles(prev => [...prev, ...extractedFiles]);
        
        toast({
          title: "ZIP Extracted",
          description: `${extractedFiles.length} files extracted from ZIP`,
        });
      } catch (error) {
        toast({
          title: "ZIP Extraction Failed",
          description: "Could not extract ZIP file contents",
          variant: "destructive",
        });
      }
    } else {
      handleFileSelect(e.target.files);
    }
  };

  const handleUpload = () => {
    if (uploadFiles.length === 0) return;
    uploadMutation.mutate(uploadFiles);
  };

  return (
    <Card className="github-border">
      <CardHeader className="border-b border-github-border">
        <CardTitle className="text-lg font-semibold text-gray-900">
          Upload Files
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        {/* Drag and Drop Area */}
        <div 
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging 
              ? 'border-github-blue bg-blue-50' 
              : 'border-github-border hover:border-github-blue'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="space-y-4">
            <CloudUpload className="h-12 w-12 text-github-gray mx-auto" />
            <div>
              <p className="text-lg font-medium text-gray-900">Drop files or folders here</p>
              <p className="text-sm text-github-gray">or use the buttons below to browse</p>
            </div>
            <input
              type="file"
              multiple
              className="hidden"
              id="file-upload"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            <input
              type="file"
              {...({ webkitdirectory: "" } as any)}
              className="hidden"
              id="folder-upload"
              onChange={handleFolderSelect}
            />
            <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
              <Label htmlFor="file-upload" className="inline-flex items-center justify-center px-4 py-3 border border-github-border rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors">
                <FolderOpen className="mr-2 h-4 w-4" />
                Select Files
              </Label>
              <Label htmlFor="folder-upload" className="inline-flex items-center justify-center px-4 py-3 border border-github-blue text-github-blue rounded-md shadow-sm text-sm font-medium bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors">
                <Folder className="mr-2 h-4 w-4" />
                Select Folder
              </Label>
            </div>
            <p className="text-xs text-github-gray">
              Folder upload preserves directory structure
            </p>
          </div>
        </div>

        {/* ZIP Upload Section */}
        <Card className="border border-github-border">
          <CardContent className="p-4">
            <h4 className="font-medium text-gray-900 mb-3">ZIP File Upload</h4>
            <div className="space-y-3">
              <input
                type="file"
                accept=".zip"
                className="w-full text-sm text-github-gray file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-github-blue file:text-white hover:file:bg-blue-700"
                onChange={handleZipUpload}
              />
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="extract-zip" 
                  checked={extractZip}
                  onCheckedChange={(checked) => setExtractZip(checked as boolean)}
                />
                <Label htmlFor="extract-zip" className="text-sm text-gray-700">
                  Extract ZIP after upload
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Progress */}
        {uploadFiles.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Upload Queue</h4>
            {uploadFiles.map((uploadFile, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">{uploadFile.file.name}</span>
                  <span className="text-sm text-github-gray">{uploadFile.progress}%</span>
                </div>
                <Progress value={uploadFile.progress} className="w-full" />
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            className="w-full github-button"
            onClick={handleUpload}
            disabled={uploadFiles.length === 0 || !selectedRepo || uploadMutation.isPending}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploadMutation.isPending ? "Uploading..." : "Push to Repository"}
          </Button>
          <Button 
            variant="outline" 
            className="w-full border-github-blue text-github-blue hover:bg-blue-50"
            disabled={!selectedRepo}
          >
            <GitBranch className="mr-2 h-4 w-4" />
            Create Pull Request
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
