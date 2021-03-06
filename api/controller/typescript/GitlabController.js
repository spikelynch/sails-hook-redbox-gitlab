"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var Rx_1 = require("rxjs/Rx");
require("rxjs/add/operator/map");
var url = require('url');
var local = require('../../../config/local');
var controller = require("../../core/typescript/controllers/CoreController");
var Controllers;
(function (Controllers) {
    var GitlabController = (function (_super) {
        __extends(GitlabController, _super);
        function GitlabController() {
            var _this = _super.call(this) || this;
            _this._exportedMethods = [
                'token',
                'user',
                'projectsRelatedRecord',
                'groups',
                'templates',
                'link',
                'checkRepo',
                'revokeToken',
                'create',
                'createWithTemplate',
                'project',
                'updateProject'
            ];
            _this.config = new Config();
            return _this;
        }
        GitlabController.prototype.token = function (req, res) {
            var _this = this;
            sails.log.debug('get token:');
            this.config.set();
            var username = req.param('username');
            var password = req.param('password');
            var accessToken = {};
            var user = {};
            if (!req.isAuthenticated()) {
                this.ajaxFail(req, res, "User not authenticated");
            }
            else {
                var userId_1 = req.user.id;
                return WorkspaceService.infoFormUserId(userId_1)
                    .flatMap(function (response) {
                    sails.log.debug('infoFormUserId');
                    sails.log.debug(response);
                    user = response;
                    return GitlabService.token(_this.config, username, password);
                })
                    .flatMap(function (response) {
                    sails.log.debug('token');
                    accessToken = response;
                    sails.log.debug(accessToken);
                    return GitlabService.user(_this.config, accessToken.access_token);
                }).flatMap(function (response) {
                    sails.log.debug('gitlab user');
                    sails.log.debug(response);
                    var gitlabUser = {
                        username: response.username,
                        id: response.id
                    };
                    return WorkspaceService.createWorkspaceInfo(userId_1, _this.config.appName, { user: gitlabUser, accessToken: accessToken });
                })
                    .subscribe(function (response) {
                    sails.log.debug('createWorkspaceInfo');
                    sails.log.debug(response);
                    _this.ajaxOk(req, res, null, { status: true });
                }, function (error) {
                    sails.log.error(error);
                    var errorMessage = "Failed to get token for user: " + username;
                    sails.log.error(errorMessage);
                    _this.ajaxFail(req, res, errorMessage, error);
                });
            }
        };
        GitlabController.prototype.revokeToken = function (req, res) {
            var _this = this;
            this.config.set();
            var userId = req.user.id;
            WorkspaceService.workspaceAppFromUserId(userId, this.config.appName)
                .flatMap(function (response) {
                sails.log.debug('workspaceAppFromUserId');
                if (response.id && response.user) {
                    return WorkspaceService.removeAppFromUserId(response.user, response.id);
                }
                else {
                    return Rx_1.Observable.of('');
                }
            }).subscribe(function (response) {
                sails.log.debug('revokeToken');
                sails.log.debug(response);
                _this.ajaxOk(req, res, null, { status: true });
            }, function (error) {
                sails.log.error(error);
                var errorMessage = "Failed to revokeToken for user: " + userId;
                sails.log.error(errorMessage);
                _this.ajaxFail(req, res, errorMessage, error);
            });
        };
        GitlabController.prototype.user = function (req, res) {
            var _this = this;
            sails.log.debug('get user:');
            this.config.set();
            var gitlab = {};
            if (!req.isAuthenticated()) {
                this.ajaxFail(req, res, "User not authenticated");
            }
            else {
                var userId_2 = req.user.id;
                return WorkspaceService.workspaceAppFromUserId(userId_2, this.config.appName)
                    .flatMap(function (response) {
                    if (!response) {
                        return Rx_1.Observable.throw('no workspace app found');
                    }
                    gitlab = response.info;
                    return GitlabService.user(_this.config, gitlab.accessToken.access_token);
                }).subscribe(function (response) {
                    response.status = true;
                    _this.ajaxOk(req, res, null, { status: true, user: gitlab.user });
                }, function (error) {
                    sails.log.error(error);
                    var errorMessage = "Failed to get user workspace info of userId: " + userId_2;
                    sails.log.error(errorMessage);
                    _this.ajaxFail(req, res, null, error);
                });
            }
        };
        GitlabController.prototype.projectsRelatedRecord = function (req, res) {
            var _this = this;
            sails.log.debug('get related projects');
            this.config.set();
            var currentProjects = [];
            var projectsWithInfo = [];
            var gitlab = {};
            var page = req.query['page'] || 1;
            var perPage = req.query['perPage'] || 10;
            var projectHeaders = {};
            if (!req.isAuthenticated()) {
                this.ajaxFail(req, res, "User not authenticated");
            }
            else {
                var userId = req.user.id;
                var branch_1 = req.param('branch') || 'master';
                return WorkspaceService.workspaceAppFromUserId(userId, this.config.appName)
                    .flatMap(function (response) {
                    gitlab = response.info;
                    return GitlabService.projects({ config: _this.config, token: gitlab['accessToken'].access_token, page: page, perPage: perPage });
                })
                    .flatMap(function (response) {
                    projectHeaders = response.headers;
                    var data = response.body;
                    var obs = [];
                    currentProjects = data.slice(0);
                    for (var _i = 0, currentProjects_1 = currentProjects; _i < currentProjects_1.length; _i++) {
                        var r = currentProjects_1[_i];
                        obs.push(GitlabService.readFileFromRepo(_this.config, gitlab['accessToken'].access_token, branch_1, r.path_with_namespace, 'stash.workspace'));
                    }
                    return Rx_1.Observable.merge.apply(Rx_1.Observable, obs);
                })
                    .subscribe(function (response) {
                    var parsedResponse = _this.parseResponseFromRepo(response);
                    projectsWithInfo.push({
                        path: parsedResponse.path,
                        info: parsedResponse.content ? _this.workspaceInfoFromRepo(parsedResponse.content) : {}
                    });
                }, function (error) {
                    var errorMessage = "Failed to get projectsRelatedRecord for token: " + gitlab['accessToken'].access_token;
                    sails.log.debug(errorMessage);
                    _this.ajaxFail(req, res, errorMessage, error);
                }, function () {
                    currentProjects.map(function (p) {
                        p.rdmp = projectsWithInfo.find(function (pwi) { return pwi.path === p.path_with_namespace; });
                    });
                    _this.ajaxOk(req, res, null, {
                        projects: currentProjects,
                        meta: {
                            previousPage: projectHeaders['x-prev-page'], totalPages: projectHeaders['x-total-pages'],
                            total: projectHeaders['x-total'], nextPage: projectHeaders['x-next-page'], page: projectHeaders['x-page'],
                            perPage: projectHeaders['x-per-page']
                        }
                    });
                });
            }
        };
        GitlabController.prototype.link = function (req, res) {
            var _this = this;
            sails.log.debug('get link');
            sails.log.debug('createWorkspaceRecord');
            this.config.set();
            if (!req.isAuthenticated()) {
                this.ajaxFail(req, res, "User not authenticated");
            }
            else {
                this.config.brandingAndPortalUrl = BrandingService.getFullPath(req);
                var project_1 = req.param('project');
                var pathWithNamespace_1 = req.param('pathWithNamespace');
                var rdmpId_1 = req.param('rdmpId');
                var recordMap_1 = req.param('recordMap');
                var branch_2 = req.param('branch') || 'master';
                var workspaceId_1 = null;
                var gitlab_1 = {};
                var recordMetadata_1 = null;
                var rdmpTitle_1 = '';
                return WorkspaceService.provisionerUser(this.config.provisionerUser)
                    .flatMap(function (response) {
                    _this.config.redboxHeaders['Authorization'] = 'Bearer ' + response.token;
                    var userId = req.user.id;
                    return WorkspaceService.workspaceAppFromUserId(userId, _this.config.appName);
                }).flatMap(function (response) {
                    gitlab_1 = response.info;
                    return WorkspaceService.getRecordMeta(_this.config, rdmpId_1);
                }).flatMap(function (response) {
                    sails.log.debug('recordMetadata');
                    recordMetadata_1 = response;
                    var record = WorkspaceService.mapToRecord(project_1, recordMap_1);
                    record = _.merge(record, { type: _this.config.recordType });
                    record.rdmpOid = rdmpId_1;
                    record.rdmpTitle = recordMetadata_1.title;
                    rdmpTitle_1 = recordMetadata_1.title;
                    var username = req.user.username;
                    return WorkspaceService.createWorkspaceRecord(_this.config, username, record, _this.config.recordType, _this.config.workflowStage);
                }).flatMap(function (response) {
                    workspaceId_1 = response.oid;
                    sails.log.debug('addWorkspaceInfo');
                    return GitlabService.addWorkspaceInfo({
                        config: _this.config, token: gitlab_1['accessToken'].access_token,
                        branch: branch_2, pathWithNamespace: pathWithNamespace_1,
                        project: project_1, workspaceLink: rdmpId_1 + '.' + workspaceId_1,
                        filePath: 'stash.workspace'
                    });
                }).flatMap(function () {
                    sails.log.debug('addWorkspaceInfo:Pretty');
                    return GitlabService.addWorkspaceInfo({
                        config: _this.config, token: gitlab_1['accessToken'].access_token,
                        branch: branch_2, pathWithNamespace: pathWithNamespace_1,
                        project: project_1,
                        workspaceLink: "Workspace linked to [" + rdmpTitle_1 + "](" + _this.config.brandingAndPortalUrl + "/record/view/" + rdmpId_1 + ") in Stash",
                        filePath: 'stash.md'
                    });
                }).flatMap(function () {
                    sails.log.debug('addParentRecordLink');
                    if (recordMetadata_1.workspaces) {
                        var wss = recordMetadata_1.workspaces.find(function (id) { return workspaceId_1 === id; });
                        if (!wss) {
                            recordMetadata_1.workspaces.push({ id: workspaceId_1 });
                        }
                    }
                    return WorkspaceService.updateRecordMeta(_this.config, recordMetadata_1, rdmpId_1);
                })
                    .subscribe(function (response) {
                    sails.log.debug('updateRecordMeta');
                    sails.log.debug(response);
                    response.status = true;
                    _this.ajaxOk(req, res, null, response);
                }, function (error) {
                    sails.log.error(error);
                    var errorMessage = "Failed to link workspace with ID: " + project_1.id;
                    sails.log.error(errorMessage);
                    _this.ajaxFail(req, res, errorMessage, error);
                });
            }
        };
        GitlabController.prototype.checkRepo = function (req, res) {
            var _this = this;
            sails.log.debug('check link');
            this.config.set();
            if (!req.isAuthenticated()) {
                this.ajaxFail(req, res, "User not authenticated");
            }
            else {
                var fieldToCheck_1 = req.param('fieldToCheck');
                var branch_3 = req.param('branch') || 'master';
                var gitlab = {};
                var userId = req.user.id;
                return WorkspaceService.workspaceAppFromUserId(userId, this.config.appName)
                    .flatMap(function (response) {
                    var gitlab = response.info;
                    return GitlabService.readFileFromRepo(_this.config, gitlab.accessToken.access_token, branch_3, fieldToCheck_1, 'stash.workspace');
                }).subscribe(function (response) {
                    sails.log.debug('checkLink:getRecordMeta');
                    var parsedResponse = _this.parseResponseFromRepo(response);
                    var wI = parsedResponse.content ? _this.workspaceInfoFromRepo(parsedResponse.content) : { rdmp: null, workspace: null };
                    sails.log.debug(wI);
                    _this.ajaxOk(req, res, null, wI);
                }, function (error) {
                    sails.log.error(error);
                    var errorMessage = "Failed check link workspace project: " + fieldToCheck_1;
                    sails.log.error(errorMessage);
                    _this.ajaxFail(req, res, errorMessage, error);
                });
            }
        };
        GitlabController.prototype.compareLink = function (req, res) {
            var _this = this;
            this.config.set();
            var rdmpId = req.param('rdmpId');
            var projectNameSpace = req.param('projectNameSpace');
            var workspaceId = req.param('workspaceId');
            this.config.brandingAndPortalUrl = BrandingService.getFullPath(req);
            return WorkspaceService.provisionerUser(this.config.provisionerUser)
                .flatMap(function (response) {
                _this.config.redboxHeaders['Authorization'] = 'Bearer ' + response.token;
                return WorkspaceService.getRecordMeta(_this.config, rdmpId);
            })
                .subscribe(function (recordMetadata) {
                sails.log.debug('recordMetadata');
                if (recordMetadata && recordMetadata.workspaces) {
                    var wss = recordMetadata.workspaces.find(function (id) { return workspaceId === id; });
                    var message = 'workspace match';
                    if (!wss) {
                        message = 'workspace not found';
                    }
                    _this.ajaxOk(req, res, null, { workspace: wss, message: message });
                }
                else {
                    var errorMessage = "Failed compare link workspace project: " + projectNameSpace;
                    _this.ajaxFail(req, res, null, errorMessage);
                }
            }, function (error) {
                var errorMessage = "Failed compare link workspace project: " + projectNameSpace;
                sails.log.error(errorMessage);
                _this.ajaxFail(req, res, errorMessage, error);
            });
        };
        GitlabController.prototype.create = function (req, res) {
            var _this = this;
            this.config.set();
            var creation = req.param('creation');
            var workspaceId = '';
            var group = creation.group;
            var namespace = group.path + '/' + creation.name;
            if (!req.isAuthenticated()) {
                this.ajaxFail(req, res, "User not authenticated");
            }
            else {
                var userId = req.user.id;
                return WorkspaceService.workspaceAppFromUserId(userId, this.config.appName)
                    .flatMap(function (response) {
                    var gitlab = response.info;
                    return GitlabService.create(_this.config, gitlab.accessToken.access_token, creation, group);
                }).subscribe(function (response) {
                    sails.log.debug('updateRecordMeta');
                    response.status = true;
                    _this.ajaxOk(req, res, null, response);
                }, function (error) {
                    sails.log.error(error);
                    var errorMessage = "Failed to create workspace with: " + namespace;
                    sails.log.error(errorMessage);
                    var data = { status: false, message: { description: errorMessage, error: error } };
                    _this.ajaxFail(req, res, null, data);
                });
            }
        };
        GitlabController.prototype.createWithTemplate = function (req, res) {
            var _this = this;
            this.config.set();
            if (!req.isAuthenticated()) {
                this.ajaxFail(req, res, "User not authenticated");
            }
            else {
                var creation_1 = req.param('creation');
                var userId = req.user.id;
                return WorkspaceService.workspaceAppFromUserId(userId, this.config.appName)
                    .flatMap(function (response) {
                    var gitlab = response.info;
                    return GitlabService.fork(_this.config, gitlab.accessToken.access_token, creation_1);
                }).subscribe(function (response) {
                    sails.log.debug('fork');
                    response.status = true;
                    _this.ajaxOk(req, res, null, response);
                }, function (error) {
                    sails.log.error(error);
                    var errorMessage = "Failed to fork project with Id: " + creation_1.template.id;
                    sails.log.error(errorMessage);
                    var data = { status: false, message: { description: errorMessage, error: error } };
                    _this.ajaxFail(req, res, null, data);
                });
            }
        };
        GitlabController.prototype.updateProject = function (req, res) {
            var _this = this;
            this.config.set();
            if (!req.isAuthenticated()) {
                this.ajaxFail(req, res, "User not authenticated");
            }
            else {
                var creation_2 = req.param('creation');
                var project_2 = {};
                var projectId_1 = creation_2.group.path + '/' + creation_2.template.name;
                project_2['name'] = creation_2.template.name;
                project_2['group'] = creation_2.group;
                project_2['attributes'] = [{ name: 'name', newValue: creation_2.name }, { name: 'path', newValue: creation_2.name }];
                var userId = req.user.id;
                return WorkspaceService.workspaceAppFromUserId(userId, this.config.appName)
                    .flatMap(function (response) {
                    var gitlab = response.info;
                    return GitlabService.updateProject(_this.config, gitlab.accessToken.access_token, projectId_1, project_2);
                }).subscribe(function (response) {
                    sails.log.debug('updateProject');
                    response.status = true;
                    _this.ajaxOk(req, res, null, response);
                }, function (error) {
                    sails.log.error(error);
                    var errorMessage = "Failed to update project with: " + creation_2;
                    sails.log.error(errorMessage);
                    var data = { status: false, message: { description: errorMessage, error: error } };
                    _this.ajaxFail(req, res, null, data);
                });
            }
        };
        GitlabController.prototype.project = function (req, res) {
            var _this = this;
            this.config.set();
            var pathWithNamespace = req.param('pathWithNamespace');
            if (!req.isAuthenticated()) {
                this.ajaxFail(req, res, "User not authenticated");
            }
            else {
                var userId = req.user.id;
                return WorkspaceService.workspaceAppFromUserId(userId, this.config.appName)
                    .flatMap(function (response) {
                    var gitlab = response.info;
                    return GitlabService.project({ config: _this.config, token: gitlab.accessToken.access_token, pathWithNamespace: pathWithNamespace });
                })
                    .subscribe(function (response) {
                    sails.log.debug('project');
                    response.status = true;
                    _this.ajaxOk(req, res, null, response);
                }, function (error) {
                    sails.log.error(error);
                    var errorMessage = "Failed to check project with: " + pathWithNamespace;
                    sails.log.error(errorMessage);
                    _this.ajaxFail(req, res, errorMessage, error);
                });
            }
        };
        GitlabController.prototype.templates = function (req, res) {
            var _this = this;
            this.config.set();
            if (!req.isAuthenticated()) {
                this.ajaxFail(req, res, "User not authenticated");
            }
            else {
                var userId = req.user.id;
                return WorkspaceService.workspaceAppFromUserId(userId, this.config.appName)
                    .flatMap(function (response) {
                    var gitlab = response.info;
                    return GitlabService.templates(_this.config, gitlab.accessToken.access_token, 'provisioner_template');
                }).subscribe(function (response) {
                    var simple = [];
                    if (response.value) {
                        simple = response.value.map(function (p) { return { id: p.id, pathWithNamespace: p.path_with_namespace, name: p.path, namespace: p.namespace.path }; });
                    }
                    _this.ajaxOk(req, res, null, simple);
                }, function (error) {
                    sails.log.error(error);
                    var errorMessage = "Failed to check templates";
                    sails.log.error(errorMessage);
                    _this.ajaxFail(req, res, errorMessage, error);
                });
            }
        };
        GitlabController.prototype.groups = function (req, res) {
            var _this = this;
            this.config.set();
            if (!req.isAuthenticated()) {
                this.ajaxFail(req, res, "User not authenticated");
            }
            else {
                var userId = req.user.id;
                return WorkspaceService.workspaceAppFromUserId(userId, this.config.appName)
                    .flatMap(function (response) {
                    var gitlab = response.info;
                    return GitlabService.groups(_this.config, gitlab.accessToken.access_token);
                }).subscribe(function (response) {
                    sails.log.debug('groups');
                    _this.ajaxOk(req, res, null, response);
                }, function (error) {
                    sails.log.error(error);
                    var errorMessage = "Failed to get groups";
                    sails.log.error(errorMessage);
                    _this.ajaxFail(req, res, errorMessage, error);
                });
            }
        };
        GitlabController.prototype.workspaceInfoFromRepo = function (content) {
            var workspaceLink = Buffer.from(content, 'base64').toString('ascii');
            if (workspaceLink) {
                var workspaceInfo = workspaceLink.split('.');
                return { rdmp: _.first(workspaceInfo), workspace: _.last(workspaceInfo) };
            }
            else {
                return { rdmp: null, workspace: null };
            }
        };
        GitlabController.prototype.parseResponseFromRepo = function (response) {
            var result = { content: null, path: '' };
            if (response.body && response.body.content) {
                result.content = response.body.content;
                var url_parts = url.parse(response.request.uri.href, true);
                var query = url_parts.query;
                result.path = query.namespace;
            }
            else {
                result.content = null;
                result.path = response.path;
            }
            return result;
        };
        return GitlabController;
    }(controller.Controllers.Core.Controller));
    Controllers.GitlabController = GitlabController;
    var Config = (function () {
        function Config() {
        }
        Config.prototype.set = function () {
            var workspaceConfig = sails.config.workspaces;
            var gitlabConfig = workspaceConfig.gitlab;
            this.host = gitlabConfig.host;
            this.recordType = gitlabConfig.recordType;
            this.workflowStage = gitlabConfig.workflowStage;
            this.formName = gitlabConfig.formName;
            this.appName = gitlabConfig.appName;
            this.parentRecord = workspaceConfig.parentRecord;
            this.provisionerUser = workspaceConfig.provisionerUser;
            this.brandingAndPortalUrl = '';
            this.redboxHeaders = {
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json',
                'Authorization': workspaceConfig.portal.authorization,
            };
        };
        return Config;
    }());
})(Controllers = exports.Controllers || (exports.Controllers = {}));
module.exports = new Controllers.GitlabController().exports();
