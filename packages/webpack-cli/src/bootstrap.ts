import { IWebpackCLI } from "./types";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const WebpackCLI = require("./webpack-cli");

const runCLI = async (args: Parameters<IWebpackCLI["run"]>[0]) => {
  // Create a new instance of the CLI object
  // 先引入 WebpackCLI 类，再实例化这个类
  const cli: IWebpackCLI = new WebpackCLI();

  try {
    // 调用实例化类的 run 方法
    await cli.run(args);
  } catch (error) {
    cli.logger.error(error);
    process.exit(2);
  }
};

module.exports = runCLI;
