let require, define;
(function (g) {
    // 判断是否是浏览器环境
    if (g !== window) {
        console.error('当前环境非浏览器环境。');
    }

    let mid = 0; // 模块标示id
    let modules = {}; // 模块列表
    let mainModule; // 主入口
    let depMap = {}; // 映射列表

    /**
     * 入口文件的加载函数
     * dep: 模块依赖
     * callback: 函数回掉
     * error: 错误处理函数
     */
    require = function (dep, callback, error) {
        modules[mainModule.name] = mainModule;
        Object.assign(mainModule, {
            dep,
            callback,
            error
        });
        mainModule.depHandler();
    };

    /**
     * 模块定义函数
     * name: 函数名称
     * dep: 函数依赖 
     * callback: 函数回掉
     * error: 错误处理函数
     */
    define = function (name, dep, callback, error) {
        // 处理只含有回调函数的情况
        if (typeof name === 'function') {
            callback = name;
            name = Util.getCurrentModule();
        }
        let module = modules[name];
        module.name = name;
        module.dep = dep;
        module.callback = callback;
        module.error = error;
        module.depHandler();
    };

    class Module {
        /**
         * Module类构造函数
         * @param {String} name 
         * @param {Array} dep 
         * @param {Function} callback 
         * @param {Function} error 
         * 
         * @memberOf Module
         */
        constructor(name, dep, callback, error) {
            this.mid = ++mid;
            this.init(name, dep, callback, error);
            this.create();
        }

        /**
         * 模块初始化函数
         * 
         * @param {String} name 
         * @param {Array} dep 
         * @param {Function} callback 
         * @param {Function} error 
         * 
         * @memberOf Module
         */
        init(name, dep, callback, error) {
            this.name = name;
            this.dep = dep;
            this.callback = callback;
            this.error = error;
            this.src = `./${name}.js`;
            this.statusHandler('INITED');
        }

        /**
         * 添加script节点
         * 
         * @memberOf Module
         */
        create() {
            let script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = this.src;
            document.body.appendChild(script);
            script.onerror = this.error;
            this.statusHandler('FETCHING');
        }

        /**
         * 分析模块的依赖组成
         * 
         * @memberOf Module
         */
        depHandler() {
            // 用于判断模块的加载状态, 如果模块加载完成, 则depCount - 1;
            let depCount = this.dep ? this.dep.length : 0;
            Object.defineProperty(this, 'depCount', {
                get() {
                    return depCount;
                },
                set(newCount) {
                    depCount = newCount;
                    // 模块全部加载完毕
                    if (newCount === 0) {
                        console.log('模块全部加载完毕');
                        // 执行模块回掉
                        this.execute();
                    }
                }
            })
            this.depCount = depCount;
            if (!this.depCount) {
                return;
            }
            this.dep.forEach((name) => {
                let module = new Module(name);
                modules[module.name] = module;
                if (!depMap[name]) {
                    depMap[name] = [];
                }
                depMap[name].push(this);
            })
        }

        execute() {
            this.statusHandler('EXECUTING');
            let arg = (this.dep || []).map((dep) => {
                return modules[dep].exports;
            });
            this.exports = this.callback.apply(this, arg);
            this.statusHandler('EXECUTED');
            console.log(`模块${this.name}执行完成`);
        }

        statusHandler(mStatus) {
            let status = Module.STATUS[mStatus];
            if (!this.status) {
                Object.defineProperty(this, 'status', {
                    get() {
                        return status;
                    },
                    set(newStatus) {
                        status = newStatus;
                        if (status === 5) {
                            // 该模块已经executed
                            let depedModules = depMap[this.name];
                            if (!depedModules) {
                                return;
                            }
                            depedModules.forEach((module) => {
                                setTimeout(() => {
                                    module.depCount--;
                                });
                            });
                        }
                    }
                });
            } else {
                this.status = status;
            }
        };
    }

    Module.STATUS = {
        INITED: 1, // 初始化完成
        FETCHING: 2, // 正在网络请求
        FETCHED: 3, // 网络请求结束
        EXECUTING: 4, // 准备开始运算模块
        EXECUTED: 5, // 模块运算完毕
        ERROR: 6 // 模块发生错误
    };


    let Util = {
        /**
         * 获取当前的主模块模块名
         * 
         * @returns 
         */
        getMainModule() {
            let main = document.currentScript.getAttribute('data-main');
            return main;
        },
        /**
         * 获取当前正在执行的script标签
         * 
         * @returns 
         */
        getCurrentModule() {
            let src = document.currentScript.getAttribute('src');
            return this.translate(src);
        },
        /**
         * src和name的转换
         * 
         * @param {any} path 
         * @returns 
         */
        translate(path) {
            let reg = /\w*.js/;
            let output = reg.exec(path);
            if (!output) {
                return path;
            } else {
                return output[0].split('.')[0];
            }
        }
    }

    mainModule = new Module(Util.getMainModule());

})(this);