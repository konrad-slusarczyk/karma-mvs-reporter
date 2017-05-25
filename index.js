var fs = require('fs');
var chalk = require('chalk');
var path = require('path');

var VisualStudioReporter = function (baseReporterDecorator, config, logger, formatError) {//function (formatError, logger) {
    
    baseReporterDecorator(this);

    var log = logger.create('reporter.vs');

    var reporterConfig = config.mvsReporter || {};

    var baseDir = reporterConfig.baseDri || "./";
    var errorLogLevel = getLogLevel(reporterConfig.logErrorAs);
    var failLogLevel = getLogLevel(reporterConfig.logFailAs);

    this.adapters = [function (msg) {
        process.stdout.write.bind(process.stdout)(msg + "rn");
    }];

    function formatVsOutput(type, file, line, col, message, code, program) {
        var vsLine = (program ? program + ":" : "") + file;
        if (line) {
            vsLine += "(" + line;
            if (col) { vsLine += "," + col; }
            vsLine += ")";
        }
        vsLine += ": " + type;//(type||"warning");
        if (code) vsLine += " " + code;
        if (message) { vsLine += ": " + message; }
        return vsLine;
    }

    function logVsErrorMessage(file, line, col, error) {
        console.error(formatVsOutput('error', file, line, col, error, 'karma'));
    }

    function logVsWarningMessage(file, line, col, error) {
        console.error(formatVsOutput('warning', file, line, col, error, 'karma'));
    }

    function logError(message) {
        console.error(chalk.red(message));
        //log.error(chalk.red(message));
    }

    function logWarning(message) {
        console.log(chalk.yellow(message));
        //log.warn(message);
    }

    function logSucces(message) {
        console.log(chalk.green(message));
        //log.info(chalk.green(message));
    }

    function getLogLevel(setting, def) {
        def = def || 'error';
        if (setting !== 'error' && setting !== 'warning') return def;
        return setting;
    }

    var skippedCount = 0;
    var failCount = 0;
    var successCount = 0;

    this.onSpecComplete = function (browser, result) {

        var path = [].concat(result.suite, result.description);
        var pathStr = path.join(" >> ");
        
        // Only log Errors
        if (result.skipped) {
            skippedCount++;
        } else if (result.success) {
            logSucces(pathStr + " TEST PASSED");
            successCount++;
        } else {
            logError(pathStr + " TEST FAILED");
            failCount++;
            result.log.forEach(function (log, idx) {

                try {
                    var errorMsg = formatError(log).trim();
                    var msgTypeSepIdx = errorMsg.indexOf(':');
                    var errType = errorMsg.substring(0, msgTypeSepIdx).trim().toLowerCase();
                    var isError = errType === "error";
                    
                    errorMsg = errorMsg.split('\n'); // split ty line

                    var filePart = errorMsg[errorMsg.length - 1].split(":"); // last line is test file reference
                    var col = parseInt(filePart[2]);
                    var line = parseInt(filePart[1]);
                    var file = baseDir + filePart[0];
                    var msg;
                        
                    if (isError) { // in test error

                        msg = errorMsg[0].substring(msgTypeSepIdx + 1).trim();
                        if (errorLogLevel === 'error')
                            logVsErrorMessage(file, line, col, msg);
                        else
                            logVsWarningMessage(file, line, col, msg);

                    } else { // test fail

                        msg = errorMsg[0].trim();
                        if (failLogLevel === 'error')
                            logVsErrorMessage(file, line, col, msg);
                        else
                            logVsWarningMessage(file, line, col, msg);

                    }
                    
                    

                } catch (e) {
                    logVsErrorMessage("", 0, 0, errorMsg.join(" -- "));
                }
                


            });
        }
    };
    
};

// inject karma runner baseReporter and config
//VsReporter.$inject = ['formatError', 'logger'];
VisualStudioReporter.$inject = ['baseReporterDecorator', 'config', 'logger', 'formatError'];

// Public module
module.exports = {
    'reporter:mvs': ['type', VisualStudioReporter]
};
