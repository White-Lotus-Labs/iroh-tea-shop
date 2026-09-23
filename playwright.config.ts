import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',fullyParallel:false,workers:1,use:{baseURL:'http://127.0.0.1:3000',headless:true,launchOptions:{args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']}},webServer:{command:'npm run dev',url:'http://127.0.0.1:3000',reuseExistingServer:true,timeout:120000}});
