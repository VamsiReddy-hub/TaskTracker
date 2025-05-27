# Real-Time Delivery Tracking Platform

A comprehensive multi-vendor delivery platform with real-time location tracking, role-based authentication, and interactive maps.

## Features

🚀 **Real-time Tracking**
- Live location updates every 2-3 seconds via WebSockets
- Interactive maps with Leaflet.js and OpenStreetMap
- Real-time order status broadcasting

👥 **Multi-Role System**
- **Vendors**: Manage orders and assign delivery partners
- **Delivery Partners**: Track deliveries with GPS location sharing
- **Customers**: Live tracking of their orders

🔒 **Security & Database**
- JWT authentication with role-based access control
- PostgreSQL database with proper relationships
- Secure API endpoints for all operations

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: Socket.IO WebSockets
- **Maps**: Leaflet.js with OpenStreetMap
- **Authentication**: JWT tokens
- **Styling**: Tailwind CSS + shadcn/ui

## Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Git

### Installation

1. **Clone or download the project**
   ```bash
   git clone <your-repo> delivery-platform
   cd delivery-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   ```
   
   Required environment variables:
   ```env
   DATABASE_URL="postgresql://username:password@host:port/database"
   JWT_SECRET="your-super-secret-jwt-key"
   NODE_ENV="development"
   PORT="5000"
   ```

4. **Database Setup**
   ```bash
   npm run db:push
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

6. **Access the Application**
   Open http://localhost:5000 in your browser

## Usage

### Registration & Login
1. Visit the application homepage
2. Click "Register" and select your role:
   - **Vendor/Restaurant**: Manage orders and delivery partners
   - **Delivery Partner**: Accept and deliver orders
   - **Customer**: Place and track orders

### Vendor Dashboard
- View real-time delivery locations on interactive map
- Assign available delivery partners to pending orders
- Monitor order statistics and revenue
- Track delivery performance metrics

### Delivery Partner Dashboard
- Go online/offline to receive orders
- Start delivery tracking with GPS location sharing
- Update order status (picked up, in transit, delivered)
- View route overview on mini-map

### Customer Tracking
- Track orders in real-time with live map updates
- View delivery status timeline
- Get estimated delivery times
- Contact delivery partner directly

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Orders
- `GET /api/orders` - Get user's orders
- `POST /api/orders` - Create new order
- `PATCH /api/orders/:id/status` - Update order status
- `PATCH /api/orders/:id/assign` - Assign delivery partner

### Location Tracking
- `POST /api/location/update` - Update delivery partner location
- `GET /api/location/partner/:id` - Get latest location
- `GET /api/location/history/:id` - Get location history

### WebSocket Events
- `location_update` - Real-time location sharing
- `order_status_update` - Live order status changes
- `delivery_location_update` - Broadcast location to customers/vendors

## Deployment

### Local Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Environment Variables for Production
```env
NODE_ENV="production"
DATABASE_URL="your-production-database-url"
JWT_SECRET="your-production-jwt-secret"
PORT="5000"
```

## Database Schema

The application uses PostgreSQL with the following main tables:
- `users` - User accounts (vendors, delivery partners, customers)
- `vendors` - Vendor/restaurant profiles
- `delivery_partners` - Delivery partner profiles with vehicle info
- `orders` - Order management with status tracking
- `location_updates` - Real-time location history

## Real-time Features

### WebSocket Implementation
- Authenticated WebSocket connections
- Role-based event broadcasting
- Automatic reconnection handling
- Live location updates every 2-3 seconds

### Location Tracking
- GPS-based real-time tracking
- Location history storage
- Geolocation permission handling
- Map visualization with custom markers

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please open an issue in the repository or contact the development team.