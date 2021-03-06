var iterDropdown;
var rallyDataSource;

function CompletedStoriesAndDefects() {
    var that = this;

    var busySpinner;
    var defectTable, storyTable;
    var abbrev = {'User Story': 'ar', 'Defect': 'df', 'Task': 'tk', 'TestCase': 'tc'};

    function artifactLink(artifactName, artifact) {
        var artUrl = "__SERVER_URL__/detail/_ABBREV_/_OID_";
        artUrl = artUrl.replace('_ABBREV_', abbrev[artifactName]);
        artUrl = artUrl.replace('_OID_', artifact.ObjectID);
        var linkText = artifact.FormattedID + " " + artifact.Name;
        var link = '<a href="_URL_" target="_blank">_TEXT_</a>'.replace('_URL_', artUrl).replace('_TEXT_', linkText);
        return link;
    }

    function indentedItem(content, color) {
        var indentationDiv = '<div style="margin-left: 20px;">' + content + '</div>';
        return indentationDiv;
    }

    function ownerIfKnown(arti) {
        var owner = "";
        if (arti.Owner) {
            if (arti.Owner.DisplayName) {
                owner = arti.Owner.DisplayName;
            }
            else if (arti.Owner.UserName) {
                owner = arti.Owner.UserName;
            }
        }
        return owner;
    }

    function showStories(stories, contentDiv) {
        var tableData = [];
        var tblConfig;
        var story,    storyLink,    storyInfo;
        var task,     taskLink,     taskInfo,    indentedTask;
        var defect,   defectLink,   defectInfo,  indentedDefect;
        var testCase, testCaseLink, tcInfo,      indentedTestCase;
        for (var i = 0; i < stories.length; i++) {
            story = stories[i];
            storyLink = artifactLink('User Story', story);
            storyInfo = { 'itemLink' : '<div style="font-weight: bold;">' + storyLink + '</div>',
                'status'   : story.ScheduleState,
                'userName' : ownerIfKnown(story)
            };
            tableData.push(storyInfo);

            for (var t = 0; t < story.Tasks.length; t++) {
                task = story.Tasks[t];
                taskLink = artifactLink('Task', task);
                indentedTask = indentedItem(taskLink);
                taskInfo = { 'itemLink' : indentedTask,
                    'status'   : task.State,
                    'userName' : ownerIfKnown(task)
                };
                if (task.State != 'Completed' && task.State != 'Accepted') {
                    tableData.push(taskInfo);
                }
            }

            for (var d = 0; d < story.Defects.length; d++) {
                defect = story.Defects[d];
                defectLink = artifactLink('Defect', defect);
                indentedDefect = indentedItem(defectLink);
                defectInfo = { 'itemLink' : indentedDefect,
                    'status'   : defect.ScheduleState,
                    'userName' : ownerIfKnown(defect)
                };
                var schedState = defect.ScheduleState;
                if (schedState != 'Completed' && schedState != 'Accepted') {
                    tableData.push(defectInfo);
                }
            }

            for (var tc = 0; tc < story.TestCases.length; tc++) {
                testCase = story.TestCases[tc];
                testCaseLink = artifactLink('TestCase', testCase);
                indentedTestCase = indentedItem(testCaseLink);
                tcInfo = { 'itemLink' : indentedTestCase,
                    'status'   : testCase.LastVerdict,
                    'userName' : ownerIfKnown(testCase)
                };
                // the following is a change from the original to be more
                // consistent in showing just the "outlier" cases
                if (testCase.LastVerdict != 'Pass') {
                    tableData.push(tcInfo);
                }
            }
        }
        tblConfig = { 'columnKeys'     : ['itemLink', 'status', 'userName'],
            'columnHeaders'  : ['Artifact', 'Status', 'Owner'   ],
            'columnWidths'   : ['400px',    '100px',  '100px'   ],
            'sortingEnabled' : false
        };
        storyTable = new rally.sdk.ui.Table(tblConfig);
        storyTable.addRows(tableData);
        storyTable.display(contentDiv);
    }

    function showDefects(defects, contentDiv) {
        var tableData = [];
        var tblConfig;
        var defect, defectLink, defectInfo;
        for (var d = 0; d < defects.length; d++) {
            defect = defects[d];
            defectLink = artifactLink('Defect', defect);
            defectInfo = { 'defectLink' : defectLink,
                'status'     : defect.ScheduleState,
                'userName'   : ownerIfKnown(defect)
            };
            tableData.push(defectInfo);
        }
        tblConfig = { 'columnKeys'    : ['defectLink', 'status', 'userName'],
            'columnHeaders' : ['Defect',     'Status', 'Owner'   ],
            'columnWidths'  : ['400px',      '100px',  '100px'   ],
            'sortingEnabled' : false
        };
        defectTable = new rally.sdk.ui.Table(tblConfig);
        defectTable.addRows(tableData);
        defectTable.display(contentDiv);
    }

    function showResults(results) {
        if(busySpinner) {
            busySpinner.hide();
            busySpinner = null;
        }
        document.getElementById("stories_count").innerHTML = "Stories: " + results.stories.length;
        if (results.stories.length > 0) {
            showStories(results.stories, "stories");
        }
        document.getElementById("defects_count").innerHTML = "Defects: " + results.defects.length;
        if (results.defects.length > 0) {
            showDefects(results.defects, "defects");
        }
    }

    that.onIterationSelected = function() {
        var targetIterationName = iterDropdown.getSelectedName();
        var queryCriteria;
        var storyScheduleStateCondition = '(ScheduleState = "Completed")';
        queryCriteria = '((Iteration.Name = "_ITER_TARGET_") AND ' + storyScheduleStateCondition + ')';
        var queryConfigs = [];
        queryConfigs[0] = { type : 'hierarchicalrequirement',
            key  : 'stories',
            fetch: 'ObjectID,FormattedID,Name,ScheduleState,State,' +
                    'Owner,UserName,DisplayName,Tasks,Defects,TestCases,LastVerdict',
            query: queryCriteria.replace('_ITER_TARGET_', targetIterationName),
            order: 'Rank desc'
        };
        queryConfigs[1] = { type : 'defect',
            key  : 'defects',
            fetch: 'ObjectID,FormattedID,Name,Owner,UserName,DisplayName,ScheduleState',
            query: queryCriteria.replace('_ITER_TARGET_', targetIterationName),
            order: 'FormattedID'
        };

        busySpinner = new rally.sdk.ui.basic.Wait({});
        busySpinner.display("wait");

        if(storyTable) {
            storyTable.destroy();
            storyTable = null;
        }
        if(defectTable) {
            defectTable.destroy();
            defectTable = null;
        }
        rallyDataSource.findAll(queryConfigs, showResults);
    };
}
