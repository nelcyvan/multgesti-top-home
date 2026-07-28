module.exports = {
  apps: [
    {
      name: "gestfin",
      script: "Gestfin.js",
      cwd: "/development/multgesti-top-home/serversNodes/gestfin",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        LD_LIBRARY_PATH: "/opt/oracle/instantclient_23_26",
        ORACLE_CLIENT_LIB: "/opt/oracle/instantclient_23_26",
      },
      error_file: "/root/.pm2/logs/gestfin-error.log",
      out_file: "/root/.pm2/logs/gestfin-out.log",
      time: true,
    },
  ],
};
