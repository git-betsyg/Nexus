process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const path = require('path');
const request = require('request');
const packageLock = require('./package-lock.json');
const downUrl = './npm-dependencies-tgz';

// 如果下载目录不存在，创建它
if (!fs.existsSync(downUrl)) {
  fs.mkdirSync(downUrl);
}

const tgz = [];
let currentTryTime = 0;
const retryTimes = 3;
const downloadFailTgz = [];

// 提取所有依赖的 tgz 下载链接
for (const pkg in packageLock.packages) {
  if (packageLock.packages[pkg].resolved) {
    const tgzUrl = packageLock.packages[pkg].resolved.split('?')[0];
    tgz.push(tgzUrl);
  }
}

// 控制并发的最大数量
const MAX_CONCURRENT_DOWNLOADS = 5;
let activeDownloads = 0;

// 下载依赖函数
async function downloadDependency(url) {
  const outUrl = url.split('/').pop();
  let outUrl2 = [outUrl];
  if (outUrl.indexOf('?') !== -1) {
    outUrl2 = outUrl.split('?');
  }

  const timestamp = Date.now();
  const outputDir = path.join(downUrl, `${outUrl2[0].replace('.tgz', '')}-${timestamp}.tgz`);

  return new Promise((resolve, reject) => {
    let receivedBytes = 0;
    let totalBytes = 0;

    const req = request({
      method: 'GET',
      uri: url,
      timeout: 60000,
    });

    req.on('response', function (data) {
      totalBytes = parseInt(data.headers['content-length']);
    });

    req.on('data', function (chunk) {
      receivedBytes += chunk.length;
      showProgress(receivedBytes, totalBytes, outUrl2[0]);
      if (receivedBytes >= totalBytes) {
        resolve();
      }
    });

    req.on('error', (e) => {
      console.log(`下载失败：${outUrl2[0]}，错误：${JSON.stringify(e)}`);
      reject(e);
    });

    req.pipe(fs.createWriteStream(outputDir));
  });
}

// 显示下载进度
function showProgress(received, total, filePath) {
  const percentage = ((received * 100) / total).toFixed(2);
  process.stdout.write(`${filePath} 下载进度：${percentage}% (${received}/${total} 字节)\r`);
  if (received === total) {
    console.log(`\n${filePath} 下载完成！`);
  }
}

// 处理每个依赖的下载（带重试机制）
async function handleDownload(url, index) {
  let tries = 0;
  while (tries < retryTimes) {
    try {
      await downloadDependency(url);
      return; // 成功则返回
    } catch (e) {
      tries++;
      console.log(`第${index + 1}次重试下载失败：${url}`);
      if (tries === retryTimes) {
        downloadFailTgz.push(url);
      }
    }
  }
}

// 管理并发下载
async function downloadAllDependencies() {
  const downloadQueue = [];

  // 控制并发下载
  for (let i = 0; i < tgz.length; i++) {
    // 每次添加到队列
    downloadQueue.push(handleDownload(tgz[i], i));

    // 当并发数达到最大值时，等待当前所有下载完成
    if (downloadQueue.length >= MAX_CONCURRENT_DOWNLOADS) {
      await Promise.race(downloadQueue);
      downloadQueue.splice(0, 1); // 移除已完成的任务
    }
  }

  // 等待所有下载任务完成
  await Promise.all(downloadQueue);

  if (downloadFailTgz.length === 0) {
    console.log('【完成】所有依赖均下载成功！');
  } else {
    console.warn('【完成】部分依赖下载失败，请手动下载：', downloadFailTgz);
  }
}

// 开始下载
downloadAllDependencies();
