## 初始化

该插件在 webpack-cli.js 的 `buildConfig` 方法中被初始化，可以认为是 webpack 的默认插件。

```javascript
item.plugins.unshift(
  new CLIPlugin({
    configPath: config.path.get(item),
    helpfulOutput: !options.json,
    hot: options.hot,
    progress: options.progress,
    prefetch: options.prefetch,
    analyze: options.analyze,
  }),
);
```

其中各参数的含义如下：

- configPath：webpack 配置文件位置
- helpfulOutput：好像没啥用，也没用上的地方
- hot：是否开启热更新，对应命令行 --hot 参数
- progress：是否打印编译进度，对应命令行 --progress 参数
- prefetch：是否预获取模块
- analyze：是否调用 webpack-bundle-analyzer 插件来获取 bundle 信息，对应命令行 --analyze 参数

在插件内部的 constructor 中，必然存在接收这些参数的方法。

```javascript
export class CLIPlugin {
  options: CLIPluginOptions;

  constructor(options: CLIPluginOptions) {
    this.options = options;
  }
}
```

debug 结果如下：

![cliplugin](https://raw.githubusercontent.com/aaaaaAndy/picture/main/images/20221129111914.png)

## apply

与基本的插件格式相同，webpack 的插件必然存在一个 apply 方法：

```javascript
export class CLIPlugin {
  apply(compiler: Compiler) {
    this.logger = compiler.getInfrastructureLogger("webpack-cli");

    if (this.options.progress) {
      this.setupProgressPlugin(compiler);
    }

    if (this.options.hot) {
      this.setupHotPlugin(compiler);
    }

    if (this.options.prefetch) {
      this.setupPrefetchPlugin(compiler);
    }

    if (this.options.analyze) {
      this.setupBundleAnalyzerPlugin(compiler);
    }

    this.setupHelpfulOutput(compiler);
  }
}
```

## setupProgressPlugin

从 webpack 中获取 ProgressPlugin 插件，并初始化执行。

```javascript
export class CLIPlugin {
  setupProgressPlugin(compiler: Compiler) {
    const { ProgressPlugin } = compiler.webpack || require("webpack");
    const progressPlugin = Boolean(
      compiler.options.plugins.find((plugin) => plugin instanceof ProgressPlugin),
      );

    if (!progressPlugin) {
      new ProgressPlugin({
        profile: this.options.progress === "profile",
      }).apply(compiler);
    }
  }
}
```


## setupHotPlugin

从 webpack 中获取 setupHotPlugin 插件，并初始化执行。

```javascript
export class CLIPlugin {
  setupHotPlugin(compiler: Compiler) {
    const { HotModuleReplacementPlugin } = compiler.webpack || require("webpack");
    const hotModuleReplacementPlugin = Boolean(
      compiler.options.plugins.find((plugin) => plugin instanceof HotModuleReplacementPlugin),
      );

    if (!hotModuleReplacementPlugin) {
      new HotModuleReplacementPlugin().apply(compiler);
    }
  }
}
```

## setupPrefetchPlugin

从 webpack 中获取 setupPrefetchPlugin 插件，并初始化执行。

```javascript
export class CLIPlugin {
  setupPrefetchPlugin(compiler: Compiler) {
    const { PrefetchPlugin } = compiler.webpack || require("webpack");

    new PrefetchPlugin(null, this.options.prefetch).apply(compiler);
  }
}
```

## setupBundleAnalyzerPlugin

从 webpack 中获取 setupBundleAnalyzerPlugin 插件，并初始化执行。

```javascript
export class CLIPlugin {
  async setupBundleAnalyzerPlugin(compiler: Compiler) {
    // eslint-disable-next-line node/no-extraneous-require,@typescript-eslint/no-var-requires
    const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
    const bundleAnalyzerPlugin = Boolean(
      compiler.options.plugins.find((plugin) => plugin instanceof BundleAnalyzerPlugin),
    );

    if (!bundleAnalyzerPlugin) {
      new BundleAnalyzerPlugin().apply(compiler);
    }
  }

}
```

## setupHelpfulOutput

打印一些帮助信息。

```javascript
export class CLIPlugin {
 setupHelpfulOutput(compiler: Compiler) {
  const pluginName = "webpack-cli";
  const getCompilationName = () => (compiler.name ? `'${compiler.name}'` : "");
  const logCompilation = (message: string) => {
    if (process.env.WEBPACK_CLI_START_FINISH_FORCE_LOG) {
      process.stderr.write(message);
    } else {
      this.logger.log(message);
    }
  };

  const { configPath } = this.options;

  // 在钩子 run 执行的时候打印两行提示信息
  compiler.hooks.run.tap(pluginName, () => {
    const name = getCompilationName();

    logCompilation(`Compiler${name ? ` ${name}` : ""} starting... `);

    if (configPath) {
      this.logger.log(`Compiler${name ? ` ${name}` : ""} is using config: '${configPath}'`);
    }
  });

  // 在钩子 watchRun 执行的时候打印提示信息
  compiler.hooks.watchRun.tap(pluginName, (compiler) => {
    const { bail, watch } = compiler.options;

    if (bail && watch) {
      this.logger.warn(
        'You are using "bail" with "watch". "bail" will still exit webpack when the first error is found.',
        );
    }

    const name = getCompilationName();

    logCompilation(`Compiler${name ? ` ${name}` : ""} starting... `);

    if (configPath) {
      this.logger.log(`Compiler${name ? ` ${name}` : ""} is using config: '${configPath}'`);
    }
  });

  // 在钩子 invalid 执行的时候打印提示信息
  compiler.hooks.invalid.tap(pluginName, (filename, changeTime) => {
    const date = new Date(changeTime);

    this.logger.log(`File '${filename}' was modified`);
    this.logger.log(`Changed time is ${date} (timestamp is ${changeTime})`);
  });

  ((compiler as Partial<Compiler>).webpack ? compiler.hooks.afterDone : compiler.hooks.done).tap(
    pluginName,
    () => {
      const name = getCompilationName();

      logCompilation(`Compiler${name ? ` ${name}` : ""} finished`);

      process.nextTick(() => {
        if (compiler.watchMode) {
          this.logger.log(`Compiler${name ? `${name}` : ""} is watching files for updates...`);
        }
      });
    },
    );
}
}
```

