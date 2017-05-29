var fs = require('fs');
var chalk = require('chalk');
var path = require('path');

var VisualStudioReporter = function (baseReporterDecorator, config, logger, formatError) {//function (formatError, logger) {

    baseReporterDecorator(this);

    var log = logger.create('reporter.vs');

    var reporterConfig = config.mvsReporter || {};

    var baseDir = reporterConfig.baseDir || "./";
    var errorLogLevel = getLogLevel(reporterConfig.logErrorAs);
    var failLogLevel = getLogLevel(reporterConfig.logFailAs);
    var msgFormat = typeof reporterConfig.messageFormat === 'string' && reporterConfig.messageFormat.length > 0 ?
        reporterConfig.messageFormat.replace(/:/g, ' ').replace(/\n/g, '\\n') :
        '{message} [{browser}] ({specSuite} {specDescription})';

    //this.adapters = [function (msg) {
    //    process.stdout.write.bind(process.stdout)(msg + "rn");
    //}];
    function formatMessage(msg, result, browserId, browser) {
        return msgFormat
            .replace(/{message}/g, msg)
            .replace(/{browser}/g, browserId)
            .replace(/{specSuite}/g, result.suite.join(' '))
            .replace(/{specDescription}/g, result.description);
    }

    function formatVsOutput(type, file, line, col, message, code, program) {
        var vsLine = (program ? program + ":" : "") + file.replace(/\//g, '\\');
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

    function getBrowserId(browser) {
        if (browser.name.indexOf('IE') === 0) return "IE";
        if (browser.name.indexOf('PhantomJS') === 0) return "PhantomJS";
        if (browser.name.indexOf('Firefox') === 0) return "Firefox";
        if (browser.name.indexOf('Chrome') === 0) return "Chrome";
        if (browser.name.indexOf('Opera') === 0) return "Opera";
        if (browser.name.indexOf('Edge') === 0) return "Edge";
        return browser.name.substring(0, browser.name.indexOf(' '));
    }

    function findFileRef(log, browserId) {
        var file = "", line = 0, col = 0;
        var logParts;
        var matches;
        var errMatch;
        var match;

        var re;
        if (browserId === 'IE' || browserId === 'Chrome' || browserId === 'Edge') {
            re = /\(([^\/\\?:"*<>\n]+(\/|\\))*[^\/\\?:"*<>\n]+:\d+:\d+\)/g;
            matches = log.match(re);
            if (matches && matches.length > 0) {
                match = matches[matches.length - 1];
                if (match) {
                    logParts = match.substring(1, match.length -1).split(':')
                    file = logParts[0];
                    col = parseInt(logParts[2]);
                    line = parseInt(logParts[1]);
                }
            }
        } else if (browserId === 'Firefox') {
            re = /@([^\/\\?:"*<>\n]+(\/|\\))*[^\/\\?:"*<>\n]+:\d+:\d+/g;
            matches = log.match(re);
            if (matches && matches.length > 0) {
                match = matches[matches.length - 1];
                if (match) {
                    logParts = match.substring(1).split(':')
                    file = logParts[0];
                    col = parseInt(logParts[2]);
                    line = parseInt(logParts[1]);
                }
            }

        //} else if (browserId === 'PhantomJS') {
        } else {
            re = /([^\/\\?:"*<>\n]+(\/|\\))*[^\/\\?:"*<>\n]+:\d+:\d+/g;
            matches = log.match(re);
            if (matches && matches.length > 0) {
                match = matches[matches.length - 1];
                if (match) {
                    logParts = match.split(':')
                    file = logParts[0];
                    col = parseInt(logParts[2]);
                    line = parseInt(logParts[1]);
                }
            }
        }

        return {
            file: file,
            line: line,
            column: col
        }

    }

    var skippedCount = 0;
    var failCount = 0;
    var successCount = 0;

    //fs.writeFileSync('./bin/karama-mvs-reporter.log.txt', '');

    this.onSpecComplete = function (browser, result) {

        var path = [].concat(result.suite, result.description);
        var pathStr = path.join(" >> ");
        var browserId = getBrowserId(browser);

        // Only log Errors
        if (result.skipped) {
            skippedCount++;
        } else if (result.success) {
            logSucces(pathStr + " TEST PASSED");
            successCount++;
        } else {
            logError(pathStr + " TEST FAILED");

            //fs.appendFileSync('./bin/karama-mvs-reporter.log.txt', pathStr + " TEST FAILED\n" + JSON.stringify(browser, null,1) + '\n');
            //fs.appendFileSync('./bin/karama-mvs-reporter.log.txt', '----\n' + JSON.stringify(result, null, 2) + "\n-----\n");
            failCount++;
            result.log.forEach(function (log, idx) {

                try {
                    var errorMsg = formatError(log).trim();
                    //fs.appendFileSync('./bin/karama-mvs-reporter.log.txt', '--\n' + errorMsg + '\n--\n');

                    var msgTypeSepIdx = errorMsg.indexOf(':');
                    var errType = errorMsg.substring(0, msgTypeSepIdx).trim().toLowerCase();
                    var isError = /error/i.test(errType);

                    
                    var fileInfo = findFileRef(errorMsg, browserId);

                    //fs.appendFileSync('./bin/karama-mvs-reporter.log.txt', '-fi-\n' + JSON.stringify(fileInfo, null, 2) + '\n-fi-\n');

                    
                    var msg = errorMsg.split('\n')[0]; // split by line

                    if (isError) { // in test error
                        msg = msg.substring(msgTypeSepIdx+1);
                        if (errorLogLevel === 'error')
                            logVsErrorMessage(fileInfo.file, fileInfo.line, fileInfo.column, formatMessage(msg, result, browserId, browser));
                        else
                            logVsWarningMessage(fileInfo.file, fileInfo.line, fileInfo.column, formatMessage(msg, result, browserId, browser));

                    } else { // test fail

                        if (failLogLevel === 'error')
                            logVsErrorMessage(fileInfo.file, fileInfo.line, fileInfo.column, formatMessage(msg, result, browserId, browser));
                        else
                            logVsWarningMessage(fileInfo.file, fileInfo.line, fileInfo.column, formatMessage(msg, result, browserId, browser));

                    }

                } catch (e) {
                    logVsErrorMessage("", 0, 0, log.replace(/\n/g, '\\n'));
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
