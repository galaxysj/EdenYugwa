# Replit.md - Eden Hangwa Order Management System

## Overview
This is a full-stack web application for Eden Hangwa (Korean traditional sweets) order management system. The application allows customers to place orders for traditional Korean sweets with customizable options, and provides an admin panel for order management and SMS notifications.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application follows a modern full-stack architecture with clear separation between frontend and backend components:

- **Frontend**: React-based SPA using Vite for development and building
- **Backend**: Express.js REST API server
- **Database**: PostgreSQL with Drizzle ORM for data persistence
- **UI Framework**: shadcn/ui components with Tailwind CSS styling
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for client-side routing

## Key Components

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with hot module replacement
- **Styling**: Tailwind CSS with custom Eden Hangwa color palette
- **UI Components**: shadcn/ui component library (Radix UI primitives)
- **Form Handling**: React Hook Form with Zod validation
- **HTTP Client**: Native fetch with TanStack Query for caching and state management
- **Routing**: Wouter for lightweight client-side routing

### Backend Architecture  
- **Framework**: Express.js with TypeScript
- **API Style**: RESTful endpoints under `/api` prefix
- **Middleware**: Request logging, JSON parsing, error handling
- **Storage**: PostgreSQL database with Drizzle ORM for persistent data storage
- **Validation**: Zod schemas for request validation

### Database Schema
Using Drizzle ORM with PostgreSQL:

**Orders Table:**
- Customer information (name, phone, address)
- Order details (box size, quantity, wrapping preference)
- Order tracking (status, order number, timestamps)
- Pricing information (total amount)

**SMS Notifications Table:**
- Order association
- Message content and recipient
- Delivery tracking

### Key Features
1. **Order Placement**: Customer form for placing orders with real-time pricing calculation
2. **Order Management**: Admin panel for viewing and updating order statuses
3. **SMS Integration**: Ready for SMS notification system integration
4. **Responsive Design**: Mobile-first design approach
5. **Form Validation**: Client and server-side validation using Zod schemas

## Data Flow
1. **Order Creation**: Customer submits order form → Validation → Storage → Order confirmation
2. **Order Management**: Admin views orders → Status updates → SMS notifications (when implemented)
3. **Real-time Updates**: TanStack Query handles cache invalidation and optimistic updates

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Neon PostgreSQL database connector
- **drizzle-orm**: Type-safe ORM with PostgreSQL support
- **@tanstack/react-query**: Server state management and caching
- **react-hook-form**: Form handling with validation
- **zod**: Schema validation for forms and API
- **wouter**: Lightweight React router

### UI Dependencies
- **@radix-ui/***: Headless UI primitives for accessibility
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library
- **class-variance-authority**: Type-safe CSS class variants

### Development Dependencies
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production builds
- **drizzle-kit**: Database migration and schema management tools

## Deployment Strategy

### Development Environment
- **Server**: `tsx server/index.ts` for hot reloading
- **Client**: Vite dev server with HMR
- **Database**: Neon PostgreSQL (requires DATABASE_URL environment variable)

### Production Build
1. **Frontend**: `vite build` outputs to `dist/public`
2. **Backend**: `esbuild` bundles server to `dist/index.js`
3. **Database**: `drizzle-kit push` applies schema changes

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string (required)
- `NODE_ENV`: Environment setting (development/production)

### Architecture Decisions

**Drizzle ORM Choice**: Selected for type safety, PostgreSQL compatibility, and excellent TypeScript integration. Provides schema-first approach with automatic type generation.

**Database Integration**: Migrated from in-memory storage to PostgreSQL with Drizzle ORM for persistent data storage across sessions and deployments.

**shadcn/ui Components**: Chosen for consistent design system, accessibility compliance, and customizable Tailwind CSS integration.

**TanStack Query**: Provides sophisticated caching, background updates, and optimistic updates for better user experience.

**Monorepo Structure**: Shared schema definitions between client and server ensure type safety across the full stack.

**Order Number System**: Implemented date-based order number generation using format `YYMMDD-순서` where YY is the 2-digit year, MMDD is month and day, and 순서 is the daily sequence number (1, 2, 3...). Example: 250802-11 for the 11th order on August 2, 2025. This provides clear chronological organization with readable hyphen separator. Updated August 2, 2025.

**Depositor Information System**: Added functionality to separate orderer and depositor information when they differ. Order forms now include a "예금자가 다릅니다" checkbox that reveals a depositor name field when checked. The admin panel displays depositor information alongside order details but hides the checkbox interface for cleaner management views. This allows for better tracking when payment is made by someone other than the orderer. Updated August 2, 2025.

The application is designed for scalability with clear separation of concerns and ready for production deployment with database persistence and SMS integration.