const request = require('request')
const csv = require('csvtojson')
const dateFormat = require('dateformat');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const headerTrans = {
    "Issue key": "name",
    "Affects Version/s": "tc:affectVersions",
    "Assignee": "tc:assignee",
    "Custom field (Backlog priority)": "tc:backlogPriority",
    "Component/s": "tc:components",
    "Description": "tc:description",
    "Environment": "tc:environment",
    "Custom field (Epic Name)": "tc:epic",
    "Fix Version/s": "tc:fixVersions",
    "Priority": "tc:priority",
    "Project name": "tc:project",
    "Reporter": "tc:reporter",
    "Security Level": "tc:securityLevel",
    "Sprint": "tc:sprint",
    "Custom field (Story Points)": "tc:storyPoints",
    "Summary": "dc:title",
    "Log Work": "tc:logWork",
    "Σ Time Spent": "tc:totalTimeSpent",
    "Custom field (Participants)": "tc:participants",
    "Custom field (Reviewers)": "tc:reviewers",
    "Custom field (Tags)": "tc:tags",
    "Creator": "tc:creator",
    "Issue Type": "tc:issueCategory",
    "Created": "tc:created"
}

const vocabs = {
    "tc:affectVersions": "Versions",
    "tc:assignee": "Users",
    "tc:components": "Components",
    "tc:fixVersions": "Versions",
    "tc:priority": "Priority",
    "tc:project": "Project",
    "tc:reporter": "Users",
    "tc:securityLevel": "Security",
    "tc:participants": "Users",
    "tc:reviewers": "Users",
    "tc:creator": "Users",
    "tc:issueCategory": "IssueType",
    "tc:tags": "Tags",
    "tc:storyPoints": "StoryPoints",
    "tc:environment": "Environment"
}

const addToVocabulary = function (header, value) {
    var vocab = vocabs[header];
    if (vocab == undefined) {
        return;
    }
    var vocabItem = { id: value, label: value, obsolete: false, ordering: 0 }
    if (vocabularies[vocab] == undefined) {
        vocabularies[vocab] = [vocabItem];
    }
    else if (vocabularies[vocab].map((item) => item.id).indexOf(value) < 0) {
        vocabularies[vocab] = vocabularies[vocab].concat(vocabItem);
    }
}

const addArray = function (arrayLine, headers) {
    var ticket = {
        "type": "Ticket"
    };
    Object.values(headerTrans).forEach(key => ticket[key] = "")
    headers.forEach(column);

    function column(value, index, array) {
        const field = headerTrans[value];
        if (field == undefined) return;

        var fieldValue = arrayLine[index].replace(/"/g, "\\\"").replace(/\\/g, "\\\\");;
        if (ticket[field] == "") {
            ticket[field] = fieldValue;
        } else if (fieldValue != "") {
            ticket[field] = fieldValue + "|" + ticket[field];
        }
        addToVocabulary(field, fieldValue);
    }

    return ticket;
}

const exportCsv = function (json) {

    const csvWriter = createCsvWriter({
        path: 'jiraOut.csv',
        header: Object.values(headerTrans).map((header) => ({ id: header, title: header })).concat({ id: "type", title: "type" })
    });

    csvWriter.writeRecords(json)
        .then(() => {
            console.log('...Done Content CSV!');
        });

    Object.keys(vocabularies).forEach(
        (vocab) => {

            const csvWriter = createCsvWriter({
                path: vocab + '.csv',
                header: [{ id: "id", title: "id" }, { id: "label", title: "label" }, { id: "obsolete", title: "obsolete" }, { id: "ordering", title: "ordering" }]
            });

            csvWriter.writeRecords(vocabularies[vocab])
                .then(() => {
                    console.log('...Done ' + vocab + " CSV!");
                });
        }
    )
}

const jiraExport = function (startDate, json) {
    console.log('New query from  ' + startDate + ";");
    var limitDate = dateFormat(new Date(startDate || "01/01/01 16:47"), "yyyy/mm/dd HH:MM");
    var requestURL = 'https://jira.nuxeo.com/sr/jira.issueviews:searchrequest-csv-all-fields/temp/SearchRequest.csv?jqlQuery=statusCategory%20%3D%20Done%20and%20created%20>%20"' + encodeURI(limitDate) + '"%20ORDER%20BY%20created%20ASC&delimiter=,&tempMax=1000';

    csv({
        noheader: true,
        output: "csv"
    })
        .fromStream(request.get(requestURL))
        .then((aa) => {
            if (aa.length < 3) {
                exportCsv(json);
                return; //finished process
            }

            for (i = (startDate == null) ? 1 : 2; i < aa.length; i++) {
                json.push(addArray(aa[i], aa[0]));
            }
            var dateStr = json[json.length - 1]["tc:created"];
            var dtArray = dateStr.split("/");

            jiraExport([dtArray[1], dtArray[0], dtArray[2]].join("/"), json);
        })
}

var vocabularies = {};
jiraExport(null, []); // Start export process