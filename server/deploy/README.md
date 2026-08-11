# 首次部署初始化（一次性，root 执行）

前置：已按 deploy.yml 配置 `API_DEPLOY_PATH`（如 `/home/www/counter-api`），站点 Nginx 配置存在。

1. 安装 sqlite3 CLI（备份用）：
   apt install -y sqlite3

2. 创建数据与备份目录、目录属主（进程以 www-data 运行）：
   mkdir -p /home/www/counter-data/backups
   chown -R www-data:www-data /home/www/counter-data

3. 安装 systemd 服务（改好 unit 里的路径后）：
   cp counter-api.service /etc/systemd/system/
   systemctl daemon-reload
   systemctl enable --now counter-api
   systemctl status counter-api

4. 把 nginx-api.conf 的 location 片段合并进站点 server 块，然后：
   nginx -t && systemctl reload nginx

5. 配置备份：
   crontab -e  # 粘贴 backup.cron 的内容
   mkdir -p /home/www/counter-data/backups

6. 手动触发一次备份验证：
   sqlite3 /home/www/counter-data/db.sqlite ".backup '/home/www/counter-data/backups/db-manual.sqlite'"

7. 首次推送代码触发 deploy.yml 的 deploy-api job 后，验证：
   curl http://127.0.0.1:8787/api/me   # 期望 {"error":"未登录。"}
