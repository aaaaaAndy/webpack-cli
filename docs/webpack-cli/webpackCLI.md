webpackCLI 类是 webpack-cli 包的核心文件，大部分功能都在改文件中实现。

```javascript
class WebpackCLI implements IWebpackCLI {
  // code...

  async run() {}
}
```

在 bootstrap 文件中，实例化了 WebpackCLI 类，并调用了其 run 方法，所以 WebpackCLI 类也正如以上代码所示。

## constructor

```javascript
// 引入 commander 依赖包，对命令行命令，参数等进行处理
const { program, Option } = require("commander");

constructor() {
    this.colors = this.createColors();
    this.logger = this.getLogger();

    // Initialize program
    this.program = program;
    this.program.name("webpack");
    this.program.configureOutput({
      writeErr: this.logger.error,
      outputError: (str, write) =>
        write(`Error: ${this.capitalizeFirstLetter(str.replace(/^error:/, "").trim())}`),
    });
  }
```

`this.color`：是为了美化命令行，对齐输出添加背景字体颜色等设置。

`this.logger`：是对 `console` 下几个输出方法的二次封装。

`this.program`：需要注意的是这里引用了 `commander` 依赖包，该 npm 包是对命令行命令，参数等进行处理，详细可以参考 [https://www.npmjs.com/package/commander](https://www.npmjs.com/package/commander)

## createColors

```javascript
createColors(useColor?: boolean): WebpackCLIColors {
  const { createColors, isColorSupported } = require("colorette");

  let shouldUseColor;

  if (useColor) {
    shouldUseColor = useColor;
  } else {
    shouldUseColor = isColorSupported;
  }

  return { ...createColors({ useColor: shouldUseColor }), isColorSupported: shouldUseColor };
}
```

该方法主要继承 colorette 包，用来对命令行进行格式化输出，比如加字体颜色，背景颜色，字体加粗，斜体等，具体可参考：[https://www.npmjs.com/package/colorette](https://www.npmjs.com/package/colorette)

最终得到的 `this.color` 如下图所示：

![this.color](https://raw.githubusercontent.com/aaaaaAndy/picture/main/images/20221027201545.png)

## getLogger

可以看出该方法只是对 `console` 下的几个打印方法做了美化封装，底层调用 this.color 的格式化输出。

```javascript
getLogger(): WebpackCLILogger {
    return {
      error: (val) => console.error(`[webpack-cli] ${this.colors.red(util.format(val))}`),
      warn: (val) => console.warn(`[webpack-cli] ${this.colors.yellow(val)}`),
      info: (val) => console.info(`[webpack-cli] ${this.colors.cyan(val)}`),
      success: (val) => console.log(`[webpack-cli] ${this.colors.green(val)}`),
      log: (val) => console.log(`[webpack-cli] ${val}`),
      raw: (val) => console.log(val),
    };
  }
```

## makeCommand

makeCommand 主要对命令进行处理，将原来配置的命令描述，命令别名等注册到 `this.command` 中，最后返回组装好的 `command`。

由代码最后 `command.action(action)` 可看出，最终是将参数中的第三个参数作为 action 注册进了命令中，所以最终还是要执行传入的这个 action。

```javascript
 /**
   * 组合命令，主要调用 commander 的方法组合命令
   * @see https://github.com/tj/commander.js/blob/HEAD/Readme_zh-CN.md
   * @param  {WebpackCLIOptions}        commandOptions 配置好的命令格式
   * @param  {WebpackCLICommandOptions} options        命令选项
   * @param  {CommandAction}            action         action 详情可见 commander 怎么注册 action
   */
async makeCommand(
  commandOptions: WebpackCLIOptions,
  options: WebpackCLICommandOptions,
  action: CommandAction,
  ): Promise<WebpackCLICommand | undefined> {
  // 加载命令
  const command = this.program.command(commandOptions.name, {
    noHelp: commandOptions.noHelp,
    hidden: commandOptions.hidden,
    isDefault: commandOptions.isDefault,
  }) as WebpackCLICommand;

  if (commandOptions.description) {
    command.description(commandOptions.description, commandOptions.argsDescription);
  }

  if (commandOptions.usage) {
    command.usage(commandOptions.usage);
  }

  if (Array.isArray(commandOptions.alias)) {
    command.aliases(commandOptions.alias);
  } else {
    command.alias(commandOptions.alias as string);
  }

  if (commandOptions.pkg) {
    command.pkg = commandOptions.pkg;
  } else {
    command.pkg = "webpack-cli";
  }

  const { forHelp } = this.program;

  let allDependenciesInstalled = true;

  // 判断命令中是否有依赖，如果有依赖，判断 package.json中是否安装了这些依赖
  if (commandOptions.dependencies && commandOptions.dependencies.length > 0) {
    for (const dependency of commandOptions.dependencies) {
     // other code ...

      await this.doInstall(dependency, {
        preMessage: () => {
          this.logger.error(
            `For using '${this.colors.green(
              commandOptions.name.split(" ")[0],
              )}' command you need to install: '${this.colors.green(dependency)}' package.`,
            );
        },
      });
    }
  }

  // 对 option 进行处理
  if (options) {
    if (typeof options === "function") {
      if (forHelp && !allDependenciesInstalled && commandOptions.dependencies) {
        command.description(
          `${
            commandOptions.description
          } To see all available options you need to install ${commandOptions.dependencies
          .map((dependency) => `'${dependency}'`)
          .join(", ")}.`,
          );
        options = [];
      } else {
        options = await options();
      }
    }

    options.forEach((optionForCommand) => {
      this.makeOption(command, optionForCommand);
    });
  }

  command.action(action);

  return command;
}
```

## makeOption

该函数是对参数进行处理，通过调用 commander 的 addOption 方法将参数一个个地添加到对应命令上。

```javascript
makeOption(command: WebpackCLICommand, option: WebpackCLIBuiltInOption) {
  //other code ...
  command.addOption(optionForCommand);
  //other code ...
}
```

## run

### 命令声明

在 webpack-cli 内部注册了一些命令，这些命令可以简单的分为内部命令和外部命令

#### 内部命令

webpack-cli 内部就能处理的命令，不需要再依赖除了 webpack 依赖的三方包，比如编译，打包，help 等。

其中 `WEBPACK_PACKAGE` 就是 `webpack`，因为 `build`，`watch`命令需要用为 webpack 包进行处理。

```javascript
// Built-in internal commands
// build 命令配置
const buildCommandOptions = {
  name: "build [entries...]",
  alias: ["bundle", "b"],
  description: "Run webpack (default command, can be omitted).",
  usage: "[entries...] [options]",
  dependencies: [WEBPACK_PACKAGE],
};
// watch 命令配置
const watchCommandOptions = {
  name: "watch [entries...]",
  alias: "w",
  description: "Run webpack and watch for files changes.",
  usage: "[entries...] [options]",
  dependencies: [WEBPACK_PACKAGE],
};
// version 命令配置
const versionCommandOptions = {
  name: "version [commands...]",
  alias: "v",
  description:
    "Output the version number of 'webpack', 'webpack-cli' and 'webpack-dev-server' and commands.",
};
// help 命令配置
const helpCommandOptions = {
  name: "help [command] [option]",
  alias: "h",
  description: "Display help for commands and options.",
};
```

#### 外部命令

外部命令都会依赖额外的 npm 包，比如 `@webpack-cli/serve`、`@webpack-cli/info` 等。

```javascript
const externalBuiltInCommandsInfo = [
  {
    name: "serve [entries...]",
    alias: ["server", "s"],
    pkg: "@webpack-cli/serve",
  },
  {
    name: "info",
    alias: "i",
    pkg: "@webpack-cli/info",
  },
  {
    name: "init",
    alias: ["create", "new", "c", "n"],
    pkg: "@webpack-cli/generators",
  },
  {
    name: "loader",
    alias: "l",
    pkg: "@webpack-cli/generators",
  },
  {
    name: "plugin",
    alias: "p",
    pkg: "@webpack-cli/generators",
  },
  {
    name: "migrate",
    alias: "m",
    pkg: "@webpack-cli/migrate",
  },
  {
    name: "configtest [config-path]",
    alias: "t",
    pkg: "@webpack-cli/configtest",
  },
];
```

#### knownCommands

`knownCommands` 定义项目中的已知命令，commander 读取到命令后可以根据 `knownCommands` 来判断 webpack-cli 是否支持此命令。

```javascript
const knownCommands = [
  buildCommandOptions,
  watchCommandOptions,
  versionCommandOptions,
  helpCommandOptions,
  ...externalBuiltInCommandsInfo,
];
```

### getCommandName

terminal 中输入的命令都是以空格隔开，其中第一个必然是命令的 name。

```javascript
const getCommandName = (name: string) => name.split(" ")[0];
```

### isKnownCommand

对比命令行获取的 name 和 knownCommands 中已经声明的命令来判断是否为 webpack-cli 支持的命令。

```javascript
const isKnownCommand = (name: string) =>
  knownCommands.find(
    (command) =>
      getCommandName(command.name) === name ||
      (Array.isArray(command.alias) ? command.alias.includes(name) : command.alias === name),
  );
```

### isCommand

判断输入的命令 input 是否为选中的命令，比如 input 传入一个 `build`，commandOptions 传入一个 `buildCommandOptions`，就可以判断当前命令是否为 build 命令，可以理解为这里是具体命令的区分。

```javascript
const isCommand = (input: string, commandOptions: WebpackCLIOptions) => {
  const longName = getCommandName(commandOptions.name);

  if (input === longName) {
    return true;
  }

  if (commandOptions.alias) {
    if (Array.isArray(commandOptions.alias)) {
      return commandOptions.alias.includes(input);
    } else {
      return commandOptions.alias === input;
    }
  }

  return false;
};
```

### findCommandByName

判断当前命令行中是否运行了某个命令，`this.program.commands` 代表了当前命令行中运行的命令。

```javascript
const findCommandByName = (name: string) =>
  this.program.commands.find(
    (command) => name === command.name() || command.aliases().includes(name),
  );
```

### isOption

判断当前是否为命令参数，因为命令参数都是以 `-` 开头，比如 `--version`、`-V` 等。

```javascript
const isOption = (value: string): boolean => value.startsWith("-");
```

### isGlobalOption

以上几个参数定义为全局参数，该方法判断当前参数是否为全局参数

```javascript
const isGlobalOption = (value: string) =>
  value === "--color" ||
  value === "--no-color" ||
  value === "-v" ||
  value === "--version" ||
  value === "-h" ||
  value === "--help";
```

### loadCommandByName

这是一个非常重要的函数，它的具体功能就是根据命令行输入的命令调用不同的方法处理。

由以下代码可以看出，`loadCommandByName` 主要干了这些事情：

1. 判断如果是 build 命令或者 watch 命令，调用 `this.makeCommand()` 方法；
2. 判断如果是 help 命令，调用 `this.makeCommand()` 方法；
3. 判断如果是 version 命令，调用 `this.makeCommand()` 方法；
4. 如果不是以上四个内部命令，那就有可能是外部命令，根据 `externalBuiltInCommandsInfo` 判断是否为外部命令，如果是外部命令，就安装 pkg 代表的依赖包，然后加载执行命令。

```javascript
const loadCommandByName = async (
   commandName: WebpackCLIExternalCommandInfo["name"],
   allowToInstall = false,
 ) => {
   // 判断是否为 build 命令
   const isBuildCommandUsed = isCommand(commandName, buildCommandOptions);

   // 判断是否为 watch 命令
   const isWatchCommandUsed = isCommand(commandName, watchCommandOptions);

   // 如果是 build 或者 watch 命令
   if (isBuildCommandUsed || isWatchCommandUsed) {
     await this.makeCommand(
       isBuildCommandUsed ? buildCommandOptions : watchCommandOptions,
       async () => {
         // 加载 webpack 包
         this.webpack = await this.loadWebpack();

         // 获取命令对应参数，作为 this.makeCommand 的第二个参数传入
         return isWatchCommandUsed
         ? this.getBuiltInOptions().filter((option) => option.name !== "watch")
         : this.getBuiltInOptions();
       },
       async (entries, options) => {
         if (entries.length > 0) {
           options.entry = [...entries, ...(options.entry || [])];
         }

         // 这里是 this.makeCommand 的第三个参数，为命令的处理函数，所以 build 命令这里是 runWebpack 方法
         await this.runWebpack(options, isWatchCommandUsed);
       },
       );
   } else if (isCommand(commandName, helpCommandOptions)) {
      // 如果是 help 命令
      // Stub for the `help` command
      // eslint-disable-next-line @typescript-eslint/no-empty-function
     this.makeCommand(helpCommandOptions, [], () => {});
   } else if (isCommand(commandName, versionCommandOptions)) {
         // 如果是 version 命令
         // Stub for the `version` command
         // eslint-disable-next-line @typescript-eslint/no-empty-function
     this.makeCommand(versionCommandOptions, [], () => {});
   } else {
    // 判断是否配置在外部命令里
     const builtInExternalCommandInfo = externalBuiltInCommandsInfo.find(
       (externalBuiltInCommandInfo) =>
       getCommandName(externalBuiltInCommandInfo.name) === commandName ||
       (Array.isArray(externalBuiltInCommandInfo.alias)
         ? externalBuiltInCommandInfo.alias.includes(commandName)
         : externalBuiltInCommandInfo.alias === commandName),
       );

     let pkg: string;

     if (builtInExternalCommandInfo) {
        // 如果是配置的外部命令，找到其 pkg 属性，也就是依赖的安装包
       ({ pkg } = builtInExternalCommandInfo);
     } else {
       pkg = commandName;
     }

     if (pkg !== "webpack-cli" && !this.checkPackageExists(pkg)) {
       if (!allowToInstall) {
         return;
       }

       // 安装 pkg 里配置的依赖包
       pkg = await this.doInstall(pkg, {
         preMessage: () => {
           this.logger.error(
             `For using this command you need to install: '${this.colors.green(pkg)}' package.`,
             );
         },
       });
     }

     let loadedCommand;

     try {
        // 加载安装的 pkg 包
       loadedCommand = await this.tryRequireThenImport<Instantiable<() => void>>(pkg, false);
     } catch (error) {
           // Ignore, command is not installed

       return;
     }

     let command;

     try {
        // 加载命令
       command = new loadedCommand();

       // 执行命令
       await command.apply(this);
     } catch (error) {
       this.logger.error(`Unable to load '${pkg}' command`);
       this.logger.error(error);
       process.exit(2);
     }
   }
};
```

### exitOverride

该方法是 commander 包提供的方法，用来重写程序异常退出的 code 码。

```javascript
// Register own exit
this.program.exitOverride(async (error) => {
  if (error.exitCode === 0) {
    process.exit(0);
  }

  if (error.code === "executeSubCommandAsync") {
    process.exit(2);
  }

  if (error.code === "commander.help") {
    process.exit(0);
  }

  if (error.code === "commander.unknownOption") {
    // other code ...

    process.exit(2);
  });
```

### 注册 --color 和 --no-color 全局参数

这段代码用来注册全局 --color 和 --no-color 全局参数，其底层也是用到了 commander 包的 option 方法。

```javascript
// Default `--color` and `--no-color` options
// eslint-disable-next-line @typescript-eslint/no-this-alias
const cli: IWebpackCLI = this;
this.program.option("--color", "Enable colors on console.");
this.program.on("option:color", function () {
// @ts-expect-error shadowing 'this' is intended
const { color } = this.opts();

cli.isColorSupportChanged = color;
cli.colors = cli.createColors(color);
});
this.program.option("--no-color", "Disable colors on console.");
this.program.on("option:no-color", function () {
// @ts-expect-error shadowing 'this' is intended
const { color } = this.opts();

cli.isColorSupportChanged = color;
cli.colors = cli.createColors(color);});
```

### 注册 -v 和 --version 全局参数

这里用来注册 --version 和 -v 全局参数，依然调用 commander 的 option 方法，其中 `outPutVersion` 中的核心代码如下：

1. 加载当前项目 package.json 文件，获取其中的 name 和 version 属性；
2. 调用 `this.logger.raw()` 格式化输出
3. 除了输出 webpack-cli 的版本，它还会输出 webpack 包的版本

```javascript
const outputVersion = async (options: string[]) => {
  // other code ...
  try {
    const { name, version } = this.loadJSONFile<BasicPackageJsonContent>(
      `${foundCommand.pkg}/package.json`,
      );

    this.logger.raw(`${name} ${version}`);
  } catch (e) {
    this.logger.error(`Error: External package '${foundCommand.pkg}' not found`);
    process.exit(2);
  }
}

this.program.option(
  "-v, --version",
  "Output the version number of 'webpack', 'webpack-cli' and 'webpack-dev-server' and commands.",
);
```

### 注册 -h 和 --help 全局参数

这里与注册 --version 命令逻辑类似，都是调用 commander 包的 options 方法。

```javascript
 const outputHelp = async () => {
  // other code ...
 }

 this.program.option("-h, --help [verbose]", "Display help for commands and options.");
```

### action

解析命令行命令，同时调用不同的方法对命令进行处理。

1. 先确定当前运行的命令 operand，如果找不到，默认是 build 命令；
2. 判断是否有 help 参数，如果有，调用 `outputHelp()` 方法；
3. 判断是否有 version 参数，如果有，调用 `outputVersion()` 方法；
4. 判断是否为已知命令，即项目中配置的内部命令和外部命令，如果是，调用 `loadCommandByName()` 处理；
5. 处理其他命令。

```javascript
this.program.action(async (options, program: WebpackCLICommand) => {
  // Command and options
  const { operands, unknown } = this.program.parseOptions(program.args);
  const defaultCommandToRun = getCommandName(buildCommandOptions.name);
  const hasOperand = typeof operands[0] !== "undefined";
  // 这里可以看出如果 operands 不存在，默认是 build 命令
  const operand = hasOperand ? operands[0] : defaultCommandToRun;
  const isHelpOption = typeof options.help !== "undefined";
  const isHelpCommandSyntax = isCommand(operand, helpCommandOptions);

  // 如果是 help 参数
  if (isHelpOption || isHelpCommandSyntax) {
    // code ...

    await outputHelp(optionsForHelp, isVerbose, isHelpCommandSyntax, program);
  }

  const isVersionOption = typeof options.version !== "undefined";
  const isVersionCommandSyntax = isCommand(operand, versionCommandOptions);

  // 如果是 version 参数
  if (isVersionOption || isVersionCommandSyntax) {
    // code ...

    await outputVersion(optionsForVersion);
  }

  // 这里默认是 build 命令
  let commandToRun = operand;
  let commandOperands = operands.slice(1);

  if (isKnownCommand(commandToRun)) {
    // webpack 配置的命令最终会走到这里，然后调用 loadCommandByName 方法
    await loadCommandByName(commandToRun, true);
  } else {
    // 对未知命令进行处理 ...

    this.logger.error("Run 'webpack --help' to see available commands and options");
    process.exit(2);
  }

  await this.program.parseAsync([commandToRun, ...commandOperands, ...unknown], {
    from: "user",
  });
});
```

### parseAsync

前边都是铺垫，最后要解析命令行命令和参数，只有这里开始解析，才会调用 `this.command.action()` 处理命令。

```javascript
await this.program.parseAsync(args, parseOptions);
```

## createCompiler

该函数的核心在于 try 内部的 `compiler = this.webpack()`，在调用 `this.makeCommand()` 时，第二个参数中执行了 `this.webpack = await this.loadWebpack();`，所以这里 `this.webpack` 就相当于 webpack 包的主体，这里是引用了 webpack 包，通过函数调用的方式将参数传给 webpack 从而来开启 webpack 打包进程。

```javascript
/**
   * 调用 webpack 方法，真是来回调
   */
async createCompiler(
  options: Partial<WebpackDevServerOptions>,
  callback?: Callback<[Error | undefined, WebpackCLIStats | undefined]>,
  ): Promise<WebpackCompiler> {

  let config = await this.loadConfig(options);
  config = await this.buildConfig(config, options);

  let compiler: WebpackCompiler;
  try {
    compiler = this.webpack(
      config.options as WebpackConfiguration,
      callback
      ? (error, stats) => {
        callback(error, stats);
      }
      : callback,
      );
      // @ts-expect-error error type assertion
  } catch (error: Error) {
    process.exit(2);
  }

  if (compiler && (compiler as WebpackV4Compiler).compiler) {
    compiler = (compiler as WebpackV4Compiler).compiler;
  }

  return compiler;
}
```


## runWebpack

该函数是 build，watch 命令的对应方法，核心逻辑是调用 `this.createCompiler()` 方法生成一个 compiler，如果是 watch 命令，再对 compiler 对象进行监听。

```javascript
async runWebpack(options: WebpackRunOptions, isWatchCommand: boolean): Promise<void> {
  const callback = (error: Error | undefined, stats: WebpackCLIStats | undefined): void => {
    // code ...
  };

  // 创建 compiler 对象
  compiler = await this.createCompiler(options as WebpackDevServerOptions, callback);

  if (!compiler) {
    return;
  }

  // 处理 watch 命令
  const isWatch = (compiler: WebpackCompiler): boolean =>
  Boolean(
    this.isMultipleCompiler(compiler)
    ? compiler.compilers.some((compiler) => compiler.options.watch)
    : compiler.options.watch,
    );

  if (isWatch(compiler) && this.needWatchStdin(compiler)) {
    process.stdin.on("end", () => {
      process.exit(0);
    });
    process.stdin.resume();
  }
}
```



## other
