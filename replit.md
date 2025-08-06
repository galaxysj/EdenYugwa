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

**Manager Interface Enhancements**: Implemented comprehensive manager interface improvements including restricted access to confirmed payment orders only, removal of depositor information from manager view for cleaner interface, custom sorting with scheduled orders at bottom, seller shipping functionality with database tracking, Excel export capability for order management, and tabbed view system (전체보기/발송주문/발송완료) for better order organization. Manager now sees orders with "발송주문" status terminology instead of "발송예약". Enhanced admin functionality to allow order status changes to "seller shipped" regardless of payment status, with unpaid orders highlighted in red with "미입금" status in manager interface. Mobile manager interface now matches admin interface exactly for consistent order status display. Updated August 6, 2025.

**Remote Area Shipping Detection**: Comprehensive remote area detection system with keywords including 제주도, 울릉도, 독도, 강화도, 백령도, 연평도, 흑산도, 진도, 가파리, 영도. Visual indicators show addresses in black with "배송비추가" text in red for clear customer notification. Updated August 3, 2025.

**Order Processing Flexibility**: Admin users can now change order status to "발송주문" regardless of payment status, providing operational flexibility. Unpaid orders in manager interface are clearly highlighted in red with "미입금" status for easy identification while maintaining processing capability. Updated August 3, 2025.

**Order Address Integrity**: Removed automatic address updates for existing orders when customer information changes. Each order now maintains its original delivery address as entered at the time of ordering, preventing unintended modifications to historical order data. Only phone number updates are synchronized across orders when customer contact information changes. Updated August 4, 2025.

**Secure Order Management System**: Implemented comprehensive security features including order password protection for non-logged-in orders (minimum 4 characters required), user-specific order filtering for logged-in users ensuring customers can only view and modify their own orders, password verification system for non-authenticated order modifications, and role-based access control preventing unauthorized order modifications. The system now supports both authenticated and non-authenticated order placement with appropriate security measures for each scenario. Updated August 4, 2025.

**Enhanced User Management Interface**: Modified manager user change functionality to display all registered users (admin, manager, and general users) instead of filtering only general users. The selection dialog now shows user roles for clear identification and allows promotion of any registered user to manager role. Updated August 4, 2025.

**Admin-Manager Role Separation for Order Status**: Implemented role-based restrictions preventing admin users from changing order status to "발송완료" (delivered), ensuring only managers can mark orders as delivered. Admin interface no longer shows "발송완료" option in status dropdown menus, and attempts to change status to delivered are blocked with appropriate error messages. This separation maintains proper workflow where managers handle final delivery confirmation while admins manage other order statuses. Updated August 6, 2025.

**Enhanced Mobile Panel Access**: Added dedicated panel access buttons to mobile dashboard header for both admin and manager users. Admins now have access to both admin panel (purple button) and manager panel (orange button) from the mobile main dashboard, providing full administrative flexibility. Managers see only their manager panel button. This eliminates navigation issues when users return to the main dashboard from their respective panels. Backend authentication already supports admin access to manager routes through `requireManagerOrAdmin` middleware. Updated August 6, 2025.

**Dashboard Content Management System**: Implemented comprehensive content management system allowing admin users to edit main dashboard text, images, and product names through a dedicated admin interface. Features include editable product names (한과1호, 한과2호), main dashboard content (titles, descriptions, hero images), and about text sections. All content is stored in PostgreSQL with CRUD API endpoints and real-time updates. Added "대시보드 콘텐츠 관리" tab to admin panel for easy content editing. Removed "사용자관리" menu item from header navigation as requested. Updated August 6, 2025.

The application is designed for scalability with clear separation of concerns and ready for production deployment with database persistence and SMS integration.