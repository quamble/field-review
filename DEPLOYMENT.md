# Field Review PWA - Cloud Deployment Guide

Deploy your Field Review app to production on major cloud platforms.

---

## 1️⃣ Heroku (Simplest - Recommended for beginners)

### Setup (5 minutes)

**Prerequisites:** Heroku account (https://signup.heroku.com)

```bash
# Install Heroku CLI
# Mac: brew tap heroku/brew && brew install heroku
# Windows: Download from https://devcenter.heroku.com/articles/heroku-cli
# Linux: curl https://cli-assets.heroku.com/install.sh | sh

# Login
heroku login

# Create your app
heroku create your-field-review-app

# Set environment variables
heroku config:set OPENAI_API_KEY=sk-your-api-key
heroku config:set NODE_ENV=production

# Deploy
git push heroku main

# View logs
heroku logs --tail

# Visit your app
heroku open
```

**Your app is now at:** `https://your-field-review-app.herokuapp.com`

### Costs
- **Free tier:** 550 free dyno hours/month (1 app runs free)
- **Paid:** $7/month (professional dyno)

### Scaling
```bash
# View dyno type
heroku dyno

# Upgrade to professional
heroku dyno:upgrade
```

---

## 2️⃣ Railway.app (Simple & Modern)

### Setup (3 minutes)

**Prerequisites:** GitHub account + Railway.app account

1. Push code to GitHub (if not already):
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/field-review.git
git push -u origin main
```

2. Go to https://railway.app/dashboard
3. Click "Create Project" → "Deploy from GitHub"
4. Select your `field-review` repository
5. Add variables:
   - `OPENAI_API_KEY`: Your API key
   - `NODE_ENV`: `production`
6. Railway automatically detects Node.js app and deploys

**Your app is now at:** `https://field-review-app-production.up.railway.app`

### Costs
- **Free tier:** $5 credit/month (usually sufficient)
- **Pay-as-you-go:** $0.30/hour for runtime

---

## 3️⃣ AWS EC2 (Full Control)

### Setup (20 minutes)

**Prerequisites:** AWS account (https://aws.amazon.com)

#### Step 1: Launch EC2 Instance

1. Go to AWS Console → EC2 → Instances
2. Click "Launch Instance"
3. Choose:
   - **AMI:** Ubuntu 22.04 LTS (free tier eligible)
   - **Instance type:** t2.micro (free tier)
   - **Storage:** 20 GB (free tier)
4. Configure Security Group:
   - Allow SSH (port 22) from your IP
   - Allow HTTP (port 80) from 0.0.0.0/0
   - Allow HTTPS (port 443) from 0.0.0.0/0
5. Review and launch

#### Step 2: Connect & Setup

```bash
# SSH into instance
ssh -i your-key.pem ubuntu@your-instance-public-ip

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Git
sudo apt-get install -y git

# Clone your repository
git clone https://github.com/YOUR_USERNAME/field-review.git
cd field-review

# Install dependencies
npm install --production

# Create .env
cp .env.example .env
nano .env  # Add your OPENAI_API_KEY
```

#### Step 3: Setup PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start app
pm2 start server.js --name "field-review"

# Auto-restart on reboot
pm2 startup
pm2 save
```

#### Step 4: Setup Nginx (Reverse Proxy)

```bash
# Install Nginx
sudo apt-get install -y nginx

# Create config
sudo tee /etc/nginx/sites-available/field-review > /dev/null <<EOF
server {
    listen 80 default_server;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/field-review /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

#### Step 5: Setup SSL/HTTPS with Let's Encrypt

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get certificate (replace with your domain)
sudo certbot certonly --standalone -d yourdomain.com

# Update Nginx config for HTTPS
sudo tee /etc/nginx/sites-available/field-review > /dev/null <<EOF
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Restart Nginx
sudo systemctl restart nginx

# Auto-renew certificate
sudo systemctl enable certbot.timer
```

**Your app is now at:** `https://yourdomain.com`

### Costs
- **t2.micro:** Free for 1 year (then $0.0116/hour)
- **Data transfer:** ~1GB free/month
- **Total typical cost:** $10-15/month after free tier

---

## 4️⃣ Google Cloud Run (Serverless & Scalable)

### Setup (15 minutes)

**Prerequisites:** Google Cloud account

```bash
# Install Google Cloud CLI
# https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login

# Set project
gcloud config set project YOUR_PROJECT_ID

# Build image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/field-review

# Deploy
gcloud run deploy field-review \
  --image gcr.io/YOUR_PROJECT_ID/field-review \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars OPENAI_API_KEY=sk-your-api-key,NODE_ENV=production
```

**Your app is now at:** `https://field-review-xxxxx.run.app`

### Costs
- **Free tier:** 2M requests/month
- **Per 1M requests:** $0.40
- **Typical usage:** $0-5/month

---

## 5️⃣ Azure App Service (Enterprise-ready)

### Setup (15 minutes)

**Prerequisites:** Azure account

```bash
# Install Azure CLI
# https://learn.microsoft.com/en-us/cli/azure/install-azure-cli

# Login
az login

# Create resource group
az group create --name field-review-rg --location eastus

# Create App Service Plan
az appservice plan create \
  --name field-review-plan \
  --resource-group field-review-rg \
  --sku B1 --is-linux

# Create Web App
az webapp create \
  --resource-group field-review-rg \
  --plan field-review-plan \
  --name field-review-app \
  --runtime "node|18.0"

# Configure deployment from GitHub
az webapp deployment github-actions add \
  --repo YOUR_GITHUB_REPO \
  --resource-group field-review-rg \
  --name field-review-app

# Set environment variables
az webapp config appsettings set \
  --resource-group field-review-rg \
  --name field-review-app \
  --settings \
    OPENAI_API_KEY=sk-your-api-key \
    NODE_ENV=production
```

**Your app is now at:** `https://field-review-app.azurewebsites.net`

### Costs
- **B1 plan:** $13.61/month (1 core, 1.75 GB RAM)
- **Free tier available:** Limited to 60 minutes/day

---

## 6️⃣ DigitalOcean App Platform (Simple & Affordable)

### Setup (10 minutes)

**Prerequisites:** DigitalOcean account

1. Go to https://cloud.digitalocean.com/apps
2. Click "Create App"
3. Connect GitHub repository
4. DigitalOcean auto-detects Node.js app
5. Set environment variables:
   - `OPENAI_API_KEY`: Your API key
   - `NODE_ENV`: `production`
6. Choose plan ($5-12/month)
7. Deploy

**Your app is now at:** `https://field-review-app.ondigitalocean.app`

### Costs
- **Starter:** $5/month (0.5 CPU, 512 MB RAM)
- **Basic:** $12/month (1 CPU, 1 GB RAM)

---

## Comparison Table

| Platform | Setup Time | Cost | Best For | Scaling |
|----------|-----------|------|----------|---------|
| **Heroku** | 5 min | $7/mo | Quick deployment | Easy |
| **Railway** | 3 min | $5+/mo | Modern workflow | Automatic |
| **AWS EC2** | 20 min | $10-15/mo | Full control | Manual |
| **Google Cloud Run** | 15 min | $0-5/mo | Serverless | Automatic |
| **Azure** | 15 min | $13+/mo | Enterprise | Good |
| **DigitalOcean** | 10 min | $5-12/mo | Balance | Good |

---

## Post-Deployment Checklist

After deploying to production:

- [ ] Test at `https://yourdomain.com`
- [ ] Verify OpenAI API transcription works
- [ ] Test Word document generation
- [ ] Check file uploads/reports storage
- [ ] Setup monitoring alerts
- [ ] Backup strategy for reports
- [ ] SSL certificate auto-renewal
- [ ] Rate limiting enabled
- [ ] Environment variables secure
- [ ] Logs enabled for debugging

---

## Monitoring & Logging

### View Logs
```bash
# Heroku
heroku logs --tail

# Railway
railway logs

# AWS (SSH required)
pm2 logs

# Google Cloud
gcloud run logs read field-review --limit 50

# Azure
az webapp log tail --name field-review-app --resource-group field-review-rg
```

### Monitor Performance
```bash
# Node.js built-in metrics
npm install node-expose-gc

# Or use platform tools:
# - Heroku Metrics
# - Railway Analytics
# - AWS CloudWatch
# - Google Cloud Console
# - Azure Application Insights
```

---

## Troubleshooting Production Issues

### "Cannot find module"
```bash
npm install --production
npm start
```

### "Port already in use"
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 PID
```

### "OpenAI API key invalid"
```bash
# Verify in environment variables
heroku config  # Heroku
gcloud run services describe field-review  # Google Cloud
```

### "Out of memory"
```bash
# Increase Node.js memory limit
export NODE_OPTIONS=--max-old-space-size=4096

# Or upgrade to larger instance
```

---

## Support

Need help? Check:
- Platform-specific docs (links above)
- Heroku support: https://help.heroku.com
- OpenAI docs: https://platform.openai.com/docs
- Node.js docs: https://nodejs.org/docs

You're all set! 🚀
