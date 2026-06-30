// PM2 进程管理配置
module.exports = {
  apps: [
    {
      name: "academic-keyword-assistant",
      script: "./server.js",
      // 使用 .env 文件加载环境变量
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // 自动重启配置
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      // 日志配置
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      merge_logs: true,
      // 资源限制
      max_memory_restart: "500M",
    },
  ],
};
