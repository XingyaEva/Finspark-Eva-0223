// PM2 配置文件 - Finspark 投资分析
module.exports = {
  apps: [
    {
      name: 'finspark',
      script: 'npx',
      args: 'wrangler pages dev dist --d1=genspark-financial-db --local --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
