module.exports = {
  apps: [
    {
      name: "gsrtc-backend",
      cwd: "./backend",
      script: "src/server.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "300M",
      autorestart: true,
      watch: false,
    },
    {
      name: "gsrtc-frontend",
      cwd: "./frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      max_memory_restart: "400M",
      autorestart: true,
      watch: false,
    },
  ],
};
