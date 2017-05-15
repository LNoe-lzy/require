let require, define;
(function (g) {
    // 判断是否是浏览器环境
    if (g !== window) {
        console.error('当前环境非浏览器环境。');
    }

    let mid = 0;         // 模块标示id
    let modules = {};    // 模块列表
    let main;            // 主入口
    let depMap = {};     // 映射列表

    /**
     * 入口文件的加载函数
     * dep: 模块依赖
     * callback: 函数回掉
     * error: 错误处理函数
     */
    require = function (dep, callback, error) {

    };
    
    /**
     * 模块定义函数
     * name: 函数名称
     * dep: 函数依赖 
     * callback: 函数回掉
     * error: 错误处理函数
     */
    define = function (name, dep, callback, error) {

    };
})(this);