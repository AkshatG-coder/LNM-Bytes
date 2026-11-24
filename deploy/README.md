# Deploying LNM Bytes on a college VM (Docker)

One VM runs everything: MongoDB, the API, both web apps, nginx (HTTPS), and a daily DB backup.

## 1. Before you start
- Docker + Docker Compose on the VM (Ubuntu: `sudo apt install docker.io docker-compose-v2`).
- Three hostnames pointing at the VM: e.g. `app.…` (students), `owner.…` (canteen), `api.…` (backend).
- A TLS certificate for them (college CA or Let's Encrypt). Put `fullchain.pem` and `privkey.pem` in `deploy/certs/`.
- Ports 80/443 reachable from the campus network (and from the internet if students use mobile data or Razorpay's webhook must reach you).
- Outbound HTTPS allowed to: api.razorpay.com, checkout.razorpay.com, generativelanguage.googleapis.com, your SMTP host, push services (fcm.googleapis.com and others), Cloudinary, Google sign-in.

## 2. Configure
1. Replace `example.edu` with your hostnames in `deploy/nginx.conf`.
2. `cp deploy/.env.example deploy/.env` and fill in every value (use long random strings for `JWT_SECRET`, `CRON_SECRET`).
3. `API_URL` must be the public `https://api…` URL. The web apps bake it in at build time, so rebuild after changing it.

## 3. Run
```
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
docker compose -f deploy/docker-compose.yml logs -f backend
```
Update later: `git pull` then run the same `up -d --build`.

## 4. After it is up
- Razorpay dashboard: webhook URL `https://api…/order/razorpay-webhook`, events `payment.captured` and `order.paid`, secret = `RAZORPAY_WEBHOOK_SECRET`. Start with `rzp_test_` keys.
- Weekly email: add a cron on the VM, e.g. every 15 min:
  `*/15 * * * * curl -s -X POST -H "x-cron-secret: <CRON_SECRET>" https://api…/summary/run`
- Backups land in `deploy/backups/` daily (14 days kept). Copy them off the VM too. Restore: `mongorestore --archive=<file> --gzip`.
- Run only ONE backend container. Live order updates and the queue are in memory, so two copies would not see each other.

## 5. Data
Old data from Atlas: `mongodump` there, then `mongorestore` into the `mongo` container.

## 6. Database note
This app uses MongoDB. Switching to PostgreSQL means rewriting all models and the aggregation queries. Only do that if the college requires it.
