# Supabase Setup Guide

This guide will help you set up Supabase authentication for the CV Analyzer backend.

## Prerequisites

- A Supabase account (sign up at https://supabase.com)
- Node.js and npm installed

## Step 1: Create a Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in the details:
   - **Name**: `cv-analyzer` (or your preferred name)
   - **Database Password**: Choose a strong password (save it somewhere safe)
   - **Region**: Choose the closest region to your users
4. Click "Create new project"
5. Wait for the project to be set up (takes ~2 minutes)

## Step 2: Get Your Supabase Credentials

1. Once your project is ready, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

## Step 3: Configure Environment Variables

1. In the backend directory (`/Users/osobne/cv-analyzer-backend`), create a `.env` file:

```bash
# Copy from .env.example
cp .env.example .env
```

2. Edit `.env` and add your Supabase credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here

PORT=3001
NODE_ENV=development
```

## Step 4: Set Up Database Tables

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (in the left sidebar)
3. Click "New Query"
4. Copy the contents of `supabase-setup.sql` and paste it into the editor
5. Click "Run" to execute the SQL

This will create:
- `profiles` table for storing user profile data
- Row Level Security (RLS) policies for data protection
- Automatic triggers for updating timestamps
- Auto-create profile on user signup

## Step 5: Configure Email Authentication (Optional)

By default, Supabase requires email verification. To customize:

1. Go to **Authentication** → **Settings** → **Email Auth**
2. Configure email templates (optional)
3. To disable email verification during development:
   - Go to **Authentication** → **Settings** → **Email Auth**
   - Disable "Enable email confirmations"
   - ⚠️ **Re-enable this in production!**

## Step 6: Test the Setup

1. Install dependencies (if you haven't already):
```bash
npm install
```

2. Start the backend server:
```bash
node src/server.js
```

3. You should see:
```
✅ Supabase connected successfully
```

## Step 7: Test Authentication

Test signup:
```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "profile": {
      "firstName": "John",
      "lastName": "Doe"
    }
  }'
```

Test signin:
```bash
curl -X POST http://localhost:3001/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## API Endpoints

### Authentication

- **POST** `/api/auth/signup` - Create new user account
- **POST** `/api/auth/signin` - Sign in existing user
- **POST** `/api/auth/signout` - Sign out user
- **GET** `/api/auth/me` - Get current user info (requires `x-session-id` header)
- **PUT** `/api/auth/profile` - Update user profile (requires `x-session-id` header)

### Using Session Tokens

After signin/signup, you'll receive a `sessionId` (access token). Use it in subsequent requests:

```bash
curl http://localhost:3001/api/auth/me \
  -H "x-session-id: your_access_token_here"
```

## Database Schema

### `profiles` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | User ID (references auth.users) |
| `email` | TEXT | User email |
| `profile_data` | JSONB | User profile data (flexible JSON) |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

### Profile Data Structure (Example)

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "currentLocation": "Bratislava, Slovakia",
  "currentPosition": "Software Developer",
  "yearsOfExperience": 5,
  "experienceLevel": "mid",
  "primarySkills": ["JavaScript", "React", "Node.js"],
  "secondarySkills": ["Docker", "PostgreSQL"],
  "languages": [
    {"language": "English", "level": "Fluent"},
    {"language": "Slovak", "level": "Native"}
  ]
}
```

## Security Features

1. **Row Level Security (RLS)**: Users can only access their own data
2. **Email Verification**: Optional email confirmation on signup
3. **Password Hashing**: Automatic secure password hashing
4. **Session Management**: JWT-based session tokens with auto-refresh
5. **SQL Injection Protection**: Parameterized queries via Supabase client

## Troubleshooting

### Error: "Invalid Supabase credentials"
- Check that your `.env` file has the correct `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Make sure there are no extra spaces or quotes

### Error: "relation 'public.profiles' does not exist"
- Run the SQL setup script in Supabase SQL Editor
- The app will still work using user metadata, but the profiles table provides better data structure

### Error: "User already registered"
- The email is already in use
- Try a different email or check Supabase dashboard → Authentication → Users

### Email verification not working
- Check your email settings in Supabase dashboard
- For development, you can disable email confirmation (see Step 5)

## Next Steps

1. ✅ Supabase is now configured for user accounts
2. 🔄 All user data is stored in Supabase (persistent across server restarts)
3. 🔐 Secure authentication with JWT tokens
4. 📧 Email verification (optional)
5. 🚀 Ready for production deployment

## Production Checklist

Before deploying to production:

- [ ] Enable email confirmation
- [ ] Set up custom email templates
- [ ] Configure password requirements
- [ ] Set up rate limiting
- [ ] Add admin dashboard access
- [ ] Configure backup policies
- [ ] Set up monitoring and alerts
- [ ] Review RLS policies

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
