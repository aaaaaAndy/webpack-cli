本系列文章是在基于 webpack-cli@4.10.0 的基础上研究的，对应的 webpack 版本为 webpack@4.26.0，也就是说整体是基于 webpack4 阅读的源码。

## 获取代码

将 webpack-cli 的官方源码 fork 到自己仓库，然后 clone 下来，基于 master 分支创建一个自己的分支：study-webpack-cli-4。这样方便我在根目录添加 docs 文件夹，添加 docs 文件夹是为了能使用 github pages 功能，让 github 识别到我写的文档，以网页的形式打开。

## 调试方法

webpack-cli 有很多种调试方法，这里介绍我用到的两种：

### 1. 命令行调试

命令行调试需要借助于 node 的 `--inspect` 参数以及 chrome 浏览器的调试工具进行调试。

1. 初始化一个新项目，只安装 webpack 和 webpack-cli，必要时候可以安装 @babel/core 和 babel-loader；
2. 安装 node-nightly 包，这是 webpack 推荐我们的安装包：[webpack 调试](https://www.webpackjs.com/contribute/debugging/)
3. 在 package.json 中配置以下命令：
  ```json
  {
    "scripts": {
      "build": "node-nightly --inspect-brk ./node_modules/webpack/bin/webpack.js build --config webpack.config.js"
    },
  }
  ```
4. 执行 `yarn build` 命令，会看到控制台输出以下文案，代表此时已进入调试模式：
  ![build](https://raw.githubusercontent.com/aaaaaAndy/picture/main/images/20221026170934.png)
5. 打开 chrome 浏览器，输入 `chrome://inspect`，会看到在 Remote Target 标题下可以进行 inspect(审查) 的活动脚本。单击脚本下自动连接会话的 "inspect" 链接就可以打开 chrome 的调试工具。
  ![inspect](https://raw.githubusercontent.com/aaaaaAndy/picture/main/images/20221026171132.png)

这里需要注意的是，webpack 和 webpack-cli 两个包在运行过程中会相互引用，它们会相互检查该项目 node_modules 目录下是否有这两个包，所以这里建议直接使用 npm 安装这两个包，不要用 npm link 去创建软链，否则会无法找到对方，报错中止程序。

使用 node-nightly 工具，需要我们明确指定需要调试的 JavaScript 文件，`--inspect-brk` 是为了能在第一行就进入断点。

### 2. webstorm 调试

webstorm 调试相对于命令行调试要简单的多，毕竟是集成 IDE。

1. 初始化一个新项目，安装 webpack, webpack-cli，必要时安装 @babel/core, babel-loader；
2. 在运行命令里配置如下，其中 `Working directory` 是工作目录，即业务文件所在位置，`JavaScript_files`指向 webpack 的入口文件，这里必须指向该文件；
  ![debug1](https://raw.githubusercontent.com/aaaaaAndy/picture/main/images/20221026164203.png)
3. 在需要调试的代码前点击出现调试红点，然后点击右上角 debug 按钮，即可进入调试模式：
  ![debug2](https://raw.githubusercontent.com/aaaaaAndy/picture/main/images/20221026165548.png)

### 3. 区别

两种方式都可调试 webpack，webpack-cli 代码，他们有一定的区别，通过命令行调试最终会执行 `./node_modules/webpack/bin/webpack.js` 文件，也会将命令行参数传递给该文件，而通过 webstorm 调试只是以 `./node_modules/webpack/bin/webpack.js` 文件为入口，以 js 的方式执行了该文件，没有命令行的各种参数。

## 目录结构

webpack-cli 的目录结构比较简单，但是当我们 clone 下来 webpack-cli 的项目源码后会发现项目结构比较复杂。查看根目录下的 package.json 文件可以得知这是使用了 lerna 同时管理了多个npm 包。

在 package.json 中：

```json
{
  "workspaces": [
    "./packages/*"
  ],
}
```

可以得出工作空间在 package 文件夹下，打开之后才能看到我们所需要的源码，其中不止包括了 webpack-cli，还有 serve，info 等几个 npm 包：

webpack-cli
- packages
  + configtest
  + generators ------ 生成 webpack 需要的各种模板，比如 loader 模板，plugin 模板
  + info ------------ 显示 webpack 信息
  + serve ----------- 开启一个本地服务，webpack-dev-serve
  + webpack-cli ----- webpack-cli 核心代码，主要对命令行各种命令进行处理，从而调用 webpack 各种方法处理打包过程