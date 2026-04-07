module.exports = {
    apps: [
        {
            name: 'tangacare-backend',
            script: 'dist/app.js',
            instances: 'max',
            exec_mode: 'cluster',
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env_production: {
                NODE_ENV: 'production',
                PORT: 4000
            }
        }
    ]
};
