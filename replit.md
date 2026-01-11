# Replit.md - Eden Hangwa Order Management System

## Overview
This is a full-stack web application for the Eden Hangwa (Korean traditional sweets) order management system. It enables customers to place orders with customizable options and provides an admin panel for order management, including planned SMS notifications. The project aims to streamline the ordering process, enhance customer experience, and provide robust tools for business operations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application features a modern full-stack architecture with distinct frontend and backend components. It emphasizes modularity, scalability, and maintainability. Now includes **Raspberry Pi deployment support** with optimized SQLite database configuration and ARM architecture compatibility.

### General Architecture
- **Frontend**: React-based Single Page Application (SPA) utilizing Vite.
- **Backend**: Express.js REST API server.
- **Database**: PostgreSQL, managed with Drizzle ORM.
- **UI/UX**: Utilizes `shadcn/ui` components built on Radix UI primitives, styled with Tailwind CSS, ensuring a consistent and responsive design (mobile-first approach) with a custom Eden Hangwa color palette.
- **State Management**: TanStack Query for efficient server state management, caching, and optimistic updates.
- **Routing**: Wouter for client-side routing.
- **Data Flow**: Employs client and server-side validation using Zod schemas for robust data integrity.

### Technical Implementation Details
- **Frontend**: React 18 with TypeScript, Vite for development (HMR) and build, React Hook Form with Zod for form handling, and native fetch for HTTP requests.
- **Backend**: Express.js with TypeScript, RESTful API endpoints, middleware for logging, JSON parsing, and error handling.
- **Database Schema**: Orders table (customer info, order details, tracking, pricing), and SMS Notifications table (order association, message content, delivery tracking). Shared schema definitions between client and server via Drizzle ORM ensure type safety.
- **Key Features**:
    - **Order Management**: Customer order placement with real-time pricing and admin panel for status updates.
    - **Dynamic Content Management**: Admin interface for managing dashboard text, images, product names, and pricing, with all content stored in PostgreSQL and real-time updates.
    - **Flexible Order Processing**: Admin users can change order status regardless of payment status, with clear highlights for unpaid orders.
    - **Secure Order Management**: Password protection for non-logged-in orders, user-specific filtering, and role-based access control for modifications.
    - **Customizable Shipping**: Admin setting to exclude specific products (e.g., wrapping cloths) from free shipping quantity calculations.
    - **Historical Data Preservation**: Orders retain original pricing and address information at the time of order, ensuring financial reporting accuracy.
    - **Order Numbering**: Date-based order number generation (YYMMDD-sequence).
    - **Depositor Information**: Separate fields for orderer and depositor when payment is from a different party.
    - **Manager Interface**: Enhanced views, restricted access to confirmed payment orders, custom sorting, seller shipping functionality, Excel export, and tabbed organization.
    - **Remote Area Detection**: Automatic detection and notification for remote shipping addresses.
    - **Role Separation**: Admin and Manager roles have specific permissions, e.g., only managers can mark orders as "delivered".
    - **Mobile Access**: Dedicated panel access buttons on mobile dashboards for both admin and manager.
    - **Raspberry Pi Support**: Optimized deployment for ARM architecture with SQLite database, memory optimization, and automated setup scripts.

## External Dependencies

- **@neondatabase/serverless**: Connector for Neon PostgreSQL database.
- **drizzle-orm**: Type-safe ORM for PostgreSQL.
- **@tanstack/react-query**: For server state management and data caching.
- **react-hook-form**: For robust form handling in React.
- **zod**: For schema validation (frontend forms, backend API).
- **wouter**: Lightweight React router.
- **@radix-ui/**: Headless UI primitives for accessible components.
- **tailwindcss**: Utility-first CSS framework.
- **lucide-react**: Icon library.
- **class-variance-authority**: For type-safe CSS class variants.
- **tsx**: TypeScript execution for development.
- **esbuild**: Fast JavaScript bundler for production.
- **drizzle-kit**: Database migration and schema management tools.