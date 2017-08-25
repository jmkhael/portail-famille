var system = require('system');

var testindex = 0;
var loadInProgress = false; //This is set to true when a page is still loading

/*********SETTINGS*********************/
var webPage = require('webpage');
var page = webPage.create();
//page.settings.userAgent = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36';
page.settings.javascriptEnabled = true;
//page.settings.loadImages = false;//Script is much faster with this field set to false
phantom.cookiesEnabled = true;
phantom.javascriptEnabled = true;
/*********SETTINGS END*****************/
var fs = require('fs');
var dir = 'out-dir';

if (fs.exists(dir)) {
  fs.removeTree(dir);
}

fs.makeDirectory(dir);

console.log('All settings loaded, start with execution');
page.onConsoleMessage = function(msg) {
  console.log(msg);
};

if (system.args.length !== 4) {
  console.log('Usage: script.js username password personid');
  phantom.exit();
}

var username = system.args[1];
var password = system.args[2];
var personid = system.args[3];

var bills = [];
var currentBill = 0;
var allBills = [];

/**********DEFINE STEPS THAT PHANTOM SHOULD DO***********************/
steps = [

    //Step 1 - Open Amazon home page
    function() {
      console.log('Step 1 - Open home page');
      page.open("https://portail-famille.colombes.fr/maelisportail/module/home/", function(status) {
        page.render(dir + "/home.png");

      });
    },
    //Step 2 - Populate and submit the login form
    function() {
      console.log('Step 2 - Populate and submit the login form: ' + username + ', ' + password);

      page.evaluate(
        function(username, password) {
          document.getElementsByName("login")[0].value = username;
          document.getElementsByName("password")[0].value = password;
          document.getElementsByClassName("linkButton")[0].click();
        },
        username, password);
      page.render(dir + "/pre-login.png");
    },
    //Step 3 - Wait to login user. After user is successfully logged in, user is redirected to home page. Content of the home page is saved to LoggedIn.html.
    function() {
      console.log("Step 3 - Wait to login user. After user is successfully logged in, user is redirected to home page. Content of the home page is saved to LoggedIn.html");
      var result = page.evaluate(function() {
        return document.querySelectorAll("html")[0].outerHTML;
      });
      fs.write(dir + '/LoggedIn.html', result, 'w');
      page.render(dir + "/LoggedIn.png");
    },
    //Step 4 - Navigate to comptes centrale
    function() {
      console.log("Step 4 - Navigate to regie");
      page.open("https://portail-famille.colombes.fr/maelisportail/module/account/invoice/consult.dhtml?person=" + personid + "&method=invoices&regie=5", function(status) {});
      console.log("rendering comptes");
    },
    function() {
      console.log("comptes.html");
      var result = page.evaluate(function() {
        return document.querySelectorAll("html")[0].outerHTML;
      });
      fs.write(dir + '/regie.html', result, 'w');
      page.render(dir + "/regie.png");
      extractBills();
    },
    //Step 5 - Navigate to comptes coclico
    function() {
      console.log("Step 5 - Navigate to coclico");
      page.open("https://portail-famille.colombes.fr/maelisportail/module/account/invoice/consult.dhtml?person=" + personid + "&method=invoices&regie=6", function(status) {});
      console.log("rendering comptes");
    },
    function() {
      console.log("writing comptes.html");
      var result = page.evaluate(function() {
        return document.querySelectorAll("html")[0].outerHTML;
      });

      fs.write(dir + '/coclico.html', result, 'w');
      page.render(dir + "/coclico.png");
      extractBills();
      },
    ];
    /**********END STEPS THAT PHANTOM SHOULD DO***********************/

    function extractBills() {
      var tempBills = page.evaluate(function() {
        var links = [];
        var hrefs = document.getElementById("contentPrint").querySelectorAll("*[href*=invoiceDetail]");
        for (var i = 0; i < hrefs.length; i++) {
          links.push(hrefs[i].href);
        }

        return links;
      });

      for (var i = 0; i < tempBills.length; i++) {
        bills.push(tempBills[i]);
      }

      currentBill = 0;
      for (var i = 0; i < tempBills.length; i++) {
        steps.push(function() {
          console.log('Treating bill #' + currentBill + ': ' + bills[currentBill]);
          page.open(bills[currentBill], function(status) {});
        });

        steps.push(function() {
            var billResult = page.evaluate(function() {
              return document.querySelectorAll("html")[0].outerHTML;
            });

            console.log('writing bill: ' + bills[currentBill]);
            fs.write(dir + '/bill' + currentBill + '.html', billResult, 'w');

            var tempBill = page.evaluate(function() {
              var bill = {
                "type" : document.getElementById("contentPrint").querySelectorAll("h1")[0].textContent.trim(),
                "billNumber" : document.getElementById("contentPrint").querySelectorAll("div.cellTitle")[0].textContent.trim(),
                "paid": document.getElementById("contentPrint").querySelectorAll("div.paid")[0].textContent.trim()
                };

                var billInfo = document.getElementById("contentPrint").querySelectorAll("div.invoiceInformation");
                for (var i = 0; i < billInfo.length; i++) {
                   console.log('"' + billInfo[i].textContent.trim() + '"');
                }

                var items = [];
                var lines = document.getElementById("contentPrint").querySelectorAll("tr.paireTab, tr.impaireTab");
                for (var i = 0; i < lines.length; i++) {
                    items.push( {
                      "id": lines[i].querySelectorAll("td:nth-child(3)")[0].innerText.trim(),
                      "description": lines[i].querySelectorAll("td:nth-child(2)")[0].innerText.trim(),
                      "period": lines[i].querySelectorAll("td:nth-child(1)")[0].innerText.trim(),
                      "amount": lines[i].querySelectorAll("td:nth-child(4)")[0].innerText.trim()
                    }
                    );
                }

                bill["items"] = items;

                return bill;
              });

              fs.write(dir + '/bill' + currentBill + '.json', JSON.stringify(tempBill), 'w');

              allBills.push(tempBill);

              currentBill++;
            });
        }
    }

    //Execute steps one by one
    interval = setInterval(executeRequestsStepByStep, 2000);

    function executeRequestsStepByStep() {
      if (loadInProgress == false && typeof steps[testindex] == "function") {
        //console.log("step " + (testindex + 1));
        steps[testindex]();
        testindex++;
      }
      if (typeof steps[testindex] != "function") {
        console.log("bills: " + JSON.stringify(allBills));
        console.log("test complete!");
        phantom.exit();
      }
    }

    /**
     * These listeners are very important in order to phantom work properly. Using these listeners, we control loadInProgress marker which controls, weather a page is fully loaded.
     * Without this, we will get content of the page, even a page is not fully loaded.
     */
    page.onLoadStarted = function() {
      loadInProgress = true;
      console.log('Loading started');
    };
    page.onLoadFinished = function() {
      loadInProgress = false;
      console.log('Loading finished');
    };
    page.onConsoleMessage = function(msg) {
      console.log(msg);
    };
