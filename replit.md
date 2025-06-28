# BytSave - Amazon Price Tracker

## Overview

BytSave is a full-stack web application that helps users track Amazon product prices and receive notifications when prices drop below their target thresholds. The system monitors products continuously, maintains price history, and sends email alerts when favorable price changes occur.

## System Architecture

### Backend Architecture
- **Node.js/Express.js**: Server framework with TypeScript support
- **PostgreSQL + Drizzle ORM**: Data persistence with schema migrations
- **Amazon PA-API v5**: Product information and price data integration
- **Authentication**: Multi-provider OAuth (Google, Facebook, Twitter) with Passport.js and Replit Auth
- **Email Service**: Nodemailer for price drop notifications
- **Caching**: LRU cache for API response optimization
- **Rate Limiting**: p-limit for Amazon API request management

### Frontend Architecture
- **React 18**: UI framework with TypeScript
- **Vite**: Build tool and development server
- **Tailwind CSS + shadcn/ui**: Styling framework with component library
- **Wouter**: Lightweight client-side routing
- **TanStack React Query**: Data fetching and state management
- **Recharts**: Data visualization for analytics

### Database Schema
- **users**: OAuth authentication data
- **products**: Amazon product information and pricing
- **tracked_products**: User price tracking preferences
- **price_history**: Historical price data for trend analysis
- **sessions**: Authentication session management
- **api_errors**: Error logging and monitoring

## Key Components

### Price Tracking System
- **Amazon API Integration**: Fetches real-time product data using signed AWS requests
- **Price Monitoring**: Automated background jobs check prices hourly
- **Alert System**: Email notifications when target prices are reached
- **Price History**: Maintains historical pricing data for trend analysis

### Authentication & Authorization
- **Multi-Provider OAuth**: Google, Facebook, Twitter integration
- **Replit Authentication**: Native Replit environment support
- **Session Management**: PostgreSQL-backed session storage
- **Protected Routes**: Client and server-side route protection

### Admin & Monitoring
- **API Error Tracking**: Comprehensive error logging and analytics
- **System Health Monitoring**: Real-time system status dashboard
- **Cache Management**: Performance optimization tools
- **Rate Limiting**: API usage control and retry logic

## Data Flow

1. **Product Addition**: Users submit Amazon URLs, system extracts ASIN and fetches product data
2. **Price Monitoring**: Background services periodically check tracked products
3. **Alert Processing**: Price comparisons trigger email notifications when thresholds are met
4. **Data Persistence**: All product data, price history, and user preferences stored in PostgreSQL
5. **Cache Strategy**: Frequently accessed product data cached to reduce API calls

## External Dependencies

### Amazon Services
- **PA-API v5**: Product data and pricing information
- **AWS Signature v4**: Request authentication for Amazon API
- **Partner Tag**: Affiliate program integration (bytsave-20)

### Authentication Providers
- **Google OAuth 2.0**: User authentication via Google accounts
- **Facebook Login**: Social authentication integration
- **Twitter OAuth**: Alternative authentication method
- **Replit Auth**: Platform-native authentication

### Email Services
- **Nodemailer**: Email delivery system
- **SMTP Configuration**: Production email service integration
- **Ethereal Email**: Development/testing email service

## Deployment Strategy

### Development Environment
- **Replit Platform**: Integrated development and hosting
- **Hot Reload**: Vite development server with HMR
- **Database**: PostgreSQL instance with auto-provisioning
- **Environment Variables**: Secure credential management

### Production Configuration
- **Build Process**: Vite frontend build + esbuild server bundle
- **Static Asset Serving**: Express.js serving built frontend
- **Database Migrations**: Drizzle migrations for schema updates
- **Process Management**: Node.js process with graceful shutdown

### Monitoring & Maintenance
- **Error Tracking**: Comprehensive API error logging
- **Performance Metrics**: Cache efficiency and API usage analytics
- **Health Checks**: System status monitoring endpoints
- **Automated Testing**: Jest test suite for critical components

## Changelog

- June 22, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.