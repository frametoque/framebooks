module.exports = {
  apps: [{
    name: 'framebooks',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    cwd: '/home/ec2-user/framebooks',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
