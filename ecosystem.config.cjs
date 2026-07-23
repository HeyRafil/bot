module.exports = {
  apps: [
    {
      name: "bot-backend",
      script: "./dist/server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1024M",
      cron_restart: "0 4 * * *",
      node_args: "--max-old-space-size=1024",
      env: {
        NODE_ENV: "production",
        BACKEND_PORT: 5000
      },
      error_file: "./logs/error.log",
      out_file: "./logs/app.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    },
    {
      name: "bot-frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "./frontend",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      node_args: "--max-old-space-size=512",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};

