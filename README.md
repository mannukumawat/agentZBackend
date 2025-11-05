# CRM Backend

Node.js/Express backend for CRM system with JWT authentication and MongoDB.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create `.env` file based on `.env.example`:
   ```
   MONGO_URI=mongodb://localhost:27017/crm
   JWT_SECRET=your_jwt_secret_here
   ENCRYPTION_KEY=your_32_character_encryption_key
   # For S3 (optional)
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   AWS_REGION=us-east-1
   S3_BUCKET_NAME=your_s3_bucket
   # For local storage
   UPLOAD_DIR=uploads
   ```

3. Start MongoDB locally or use a cloud service like MongoDB Atlas.

4. Run the server:
   ```
   npm run dev  # For development with nodemon
   npm start    # For production
   ```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/me` - Get current user info

### Agents (Admin only)
- `POST /api/agents` - Create new agent
- `GET /api/agents` - List all agents

### Customers
- `POST /api/customers` - Create customer (multipart for files)
- `GET /api/customers` - List customers with pagination/filters
- `GET /api/customers/:id` - Get customer details
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer
- `POST /api/customers/:id/assign` - Assign customer to agent (Admin)

### Call Histories
- `POST /api/call-histories` - Add call history entry
- `GET /api/call-histories?customerId=...` - Get call histories for customer
- `GET /api/call-histories/agent/:agentId` - Get call histories for agent

### Uploads
- `POST /api/uploads` - Upload file (returns file URL)

## Security
- JWT authentication required for all endpoints except login
- Role-based access: Agents see only assigned customers, Admins see all
- Sensitive data (Aadhaar, PAN) encrypted in DB
- Input validation with express-validator

## Testing
Run tests with:
```
npm test
