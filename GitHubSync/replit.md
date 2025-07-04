# GitHubSync - Repository File Manager

## Overview

GitHubSync is a full-stack web application that provides a comprehensive file management interface for GitHub repositories. The application allows users to authenticate with GitHub OAuth, browse repository contents, upload files, manage directories, and track recent activity across their repositories.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: Radix UI primitives with custom Shadcn/ui components
- **Styling**: Tailwind CSS with custom GitHub-inspired design tokens
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon (serverless PostgreSQL)
- **Session Management**: In-memory storage with fallback to database persistence
- **Build System**: ESBuild for server bundling

### Authentication Strategy
- **OAuth Provider**: GitHub OAuth 2.0 flow
- **Token Storage**: Secure server-side session management
- **API Integration**: Direct GitHub API calls using stored access tokens

## Key Components

### Data Models
The application defines three core entities in `shared/schema.ts`:
- **Users**: GitHub user information and access tokens
- **Repositories**: User repository metadata and sync status
- **File Operations**: Activity tracking for file uploads, deletions, and folder creation

### Core Features
1. **Repository Browser**: Navigate repository file trees with branch selection
2. **File Upload**: Drag-and-drop file upload with progress tracking and ZIP extraction
3. **File Management**: Delete files and create folders directly through GitHub API
4. **Activity Tracking**: Real-time activity feed of all file operations
5. **Multi-Branch Support**: Work across different repository branches

### Storage Abstraction
The application implements a storage interface pattern with PostgreSQL database persistence using Drizzle ORM. The DatabaseStorage class provides full CRUD operations for users, repositories, and file operations with proper data validation and type safety.

## Data Flow

1. **Authentication Flow**: User authenticates via GitHub OAuth → Server exchanges code for access token → User session established
2. **Repository Data**: Client queries repositories → Server fetches from GitHub API → Data cached and returned
3. **File Operations**: User performs file action → Server calls GitHub API → Operation logged to database → UI updates via query invalidation
4. **Real-time Updates**: File operations trigger activity log updates through optimistic UI updates and background refetching

## External Dependencies

### Core Dependencies
- **GitHub API**: Primary integration for all repository operations
- **Neon Database**: Serverless PostgreSQL for data persistence
- **Radix UI**: Accessible component primitives
- **TanStack Query**: Server state management and caching
- **Drizzle ORM**: Type-safe database operations

### Development Tools
- **Vite**: Development server and build tooling with Replit integration
- **Tailwind CSS**: Utility-first styling framework
- **TypeScript**: Type safety across the entire stack

## Deployment Strategy

### Development Environment
- Vite development server with HMR for frontend
- Node.js server with file watching for backend
- Environment-based configuration for database connections

### Production Build
- Frontend: Vite builds optimized static assets to `dist/public`
- Backend: ESBuild bundles server code to `dist/index.js`
- Single deployment artifact with static file serving

### Environment Configuration
- Database URL required for Drizzle connection
- GitHub OAuth credentials (client ID and secret) required
- Automatic environment variable detection for Replit deployment

The architecture prioritizes developer experience with hot reloading, type safety, and modern tooling while maintaining production readiness with optimized builds and robust error handling.

## Changelog
- July 04, 2025. Initial setup
- July 04, 2025. Added PostgreSQL database with Drizzle ORM
- July 04, 2025. Enhanced authentication with personal access token support
- July 04, 2025. Added folder upload and batch file upload capabilities

## User Preferences
Preferred communication style: Simple, everyday language.