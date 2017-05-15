let require, define;
(function (g) {
    // 判断是否是浏览器环境
    if (g !== window) {
        console.error('当前环境非浏览器环境。');
    }

    let mid = 0; // 模块标示id
    let tid = 0; // 任务标示id
    let modules = {}; // 模块列表
    let mainModule; // 主入口
    let depMap = {}; // 映射列表
    let tasks = {} // 存放当前正在执行的任务

    // 定义模块的状态机制
    const STATUS = {
        INITED: 1, // 初始化完成
        FETCHING: 2, // 正在网络请求
        FETCHED: 3, // 网络请求结束
        EXECUTING: 4, // 准备开始运算模块
        EXECUTED: 5, // 模块运算完毕
        ERROR: 6 // 模块发生错误
    };

    /**
     * 入口文件的加载函数
     * dep: 模块依赖
     * callback: 函数回掉
     * error: 错误处理函数
     */
    require = function (dep, callback, error) {
        if (typeof dep === 'function') {
            cb = dep;
            dep = undefined;
        }
        let task = new Task(dep, callback, error);
        task.depHandler();
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
        } else if (Array.isArray(name) && typeof dep === 'function') {
            // 判断define含有模块依赖但是没有指定用户名的情况
            callback = dep;
            dep = name;
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
            if (!this.src) {
                return;
            }
            let script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = this.src;
            document.body.appendChild(script);
            script.onerror = this.error;
            // 当模块加载完成后我们需要移除不必要的script节点
            script.onload = () => {
                document.body.removeChild(script);
            }
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
            // 处理dep中包含'require'的特殊情况
            let requireInDep = (this.dep || []).indexOf('require');
            if (requireInDep !== -1) {
                depCount--;
                this.requireInDep = requireInDep;
                this.dep.splice(requireInDep, 1);
            }
            // 处理循环依赖情况
            let cycleArray = this.checkCycle();
            if (cycleArray) {
                depCount = depCount - cycleArray.length;
            }

            if (depCount === 0) {
                this.execute();
                return;
            }
            Object.defineProperty(this, 'depCount', {
                get() {
                    return depCount;
                },
                set(newCount) {
                    depCount = newCount;
                    // 模块全部加载完毕
                    if (newCount === 0) {
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
                // 缓存当前的模块
                if (!modules[name]) {
                    let module = new Module(name);
                    modules[module.name] = module;
                }
                // 缓存模块和任务依赖
                if (!depMap[name]) {
                    depMap[name] = [];
                }
                // 存放被依赖的Module对象
                depMap[name].push(this);
            })
        }

        execute() {
            this.statusHandler('EXECUTING');
            let arg = (this.dep || []).map((dep) => {
                return modules[dep].exports;
            });
            // 插入require到回调函数的参数列表中
            if (this.requireInDep !== -1 && this.requireInDep !== undefined) {
                arg.splice(this.requireInDep, 0, require);
            }
            this.exports = this.callback.apply(this, arg);
            this.statusHandler('EXECUTED');
        }

        statusHandler(mStatus) {
            let status = STATUS[mStatus];
            if (!this.status) {
                Object.defineProperty(this, 'status', {
                    get() {
                        return status;
                    },
                    set(newStatus) {
                        status = newStatus;
                        // status为5的时候表示模块已经执行完成
                        if (status === 5) {
                            let depedModules = depMap[this.name];
                            if (!depedModules) {
                                return;
                            }
                            // 当依赖的模块执行完成的时候,我们需要把函数的依赖数减一
                            depedModules.forEach((module) => {
                                // 放在异步队列的首位执行
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
        }

        /**
         * 判断是否出现循环依赖，如果出现循环依赖，将模块输出
         * 
         * @returns 
         * 
         * @memberOf Module
         */
        checkCycle() {
            let cycleDep = [];
            for (let name of (this.dep || [])) {
                if (depMap[this.name] && depMap[this.name].indexOf(modules[name]) !== -1) {
                    cycleDep.push(name);
                }
            }
            return cycleDep.length ? cycleDep : undefined;
        }
    }

    /**
     * 任务类，用于存放当前正在执行的任务及模块的回调函数，用于解决模块间的循环依赖问题。
     * 
     * @class Task
     * @extends {Module}
     */
    class Task extends Module {
        constructor(dep, callback, error) {
            super();
            this.tid = ++tid;
            this.init(dep, callback, error)
        }

        /**
         * task的初始化
         * 
         * @param {Array} dep 
         * @param {Function} callback 
         * @param {Function} error 
         * 
         * @memberOf Task
         */
        init(dep, callback, error) {
            this.dep = dep;
            this.callback = callback;
            this.error = error;
            // 将任务存放到任务列表
            tasks[this.tid] = this;
        }
    }


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
    modules[mainModule.name] = mainModule;


})(this);