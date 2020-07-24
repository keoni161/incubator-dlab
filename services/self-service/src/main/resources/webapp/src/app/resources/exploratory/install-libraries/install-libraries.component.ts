/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */


import {Component, OnInit, ViewChild, ViewEncapsulation, ChangeDetectorRef, Inject, OnDestroy, AfterViewInit} from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormControl } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { debounceTime } from 'rxjs/operators';

import { InstallLibrariesModel } from './install-libraries.model';
import { LibrariesInstallationService } from '../../../core/services';
import { SortUtils, HTTP_STATUS_CODES } from '../../../core/util';
import {FilterLibsModel} from './filter-libs.model';

interface Library {
  name: string;
  version: string;
}


@Component({
  selector: 'install-libraries',
  templateUrl: './install-libraries.component.html',
  styleUrls: ['./install-libraries.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class InstallLibrariesComponent implements OnInit, OnDestroy {

  public model: InstallLibrariesModel;
  public notebook: any;
  public filteredList: any = [];
  public groupsList: Array<string>;
  public notebookLibs: Array<any> = [];
  public notebookFailedLibs: Array<any> = [];
  public loadLibsTimer: any;

  public query: string = '';
  public group: string;
  public destination: any;
  public uploading: boolean = false;
  public libs_uploaded: boolean = false;
  public validity_format: string = '';
  public isInstalled: boolean = false;
  public isInSelectedList: boolean = false;
  public installingInProgress: boolean = false;
  public libSearch: FormControl = new FormControl();
  public groupsListMap = {
    'r_pkg': 'R packages',
    'pip2': 'Python 2',
    'pip3': 'Python 3',
    'os_pkg': 'Apt/Yum',
    'others': 'Others',
    'java': 'Java'
  };

  private readonly CHECK_GROUPS_TIMEOUT: number = 5000;
  private clear: number;

  public filterConfiguration: FilterLibsModel = new FilterLibsModel('', [], [], [], []);
  public filterModel: FilterLibsModel = new FilterLibsModel('', [], [], [], []);
  public filtered: boolean;
  public filtredNotebookLibs: Array<any> = [];

  @ViewChild('groupSelect', { static: false }) group_select;
  @ViewChild('resourceSelect', { static: false }) resource_select;
  @ViewChild('trigger', { static: false }) matAutoComplete;
  public isLibInfoOpened = {  };
  private isLibExist: boolean;
  public lib: Library = {name: '', version: ''};
  public javaLib: {group, artifact, version} = {group: '', artifact: '', version: ''};
  private selectedLib: any = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    public toastr: ToastrService,
    public dialog: MatDialog,
    public dialogRef: MatDialogRef<InstallLibrariesComponent>,
    private librariesInstallationService: LibrariesInstallationService,
    private changeDetector: ChangeDetectorRef
  ) {
    this.model = InstallLibrariesModel.getDefault(librariesInstallationService);
  }

  ngOnInit() {
    this.open(this.data);
    this.libSearch.disable();
    this.libSearch.valueChanges
      .pipe(
      debounceTime(1000))
      .subscribe(newValue => {
        this.query = newValue;
        this.isDuplicated(this.lib);
        this.filterList();
      });
  }

  ngOnDestroy() {
    window.clearTimeout(this.loadLibsTimer);
    window.clearTimeout(this.clear);
  }

  uploadLibGroups(): void {
    this.libs_uploaded = false;
    this.uploading = true;
    this.librariesInstallationService.getGroupsList(this.notebook.project, this.notebook.name, this.model.computational_name)
      .subscribe(
        response => {
          this.libsUploadingStatus(response);
          this.changeDetector.detectChanges();

          this.resource_select && this.resource_select.setDefaultOptions(
            this.getResourcesList(),
            this.destination.title, 'destination', 'title', 'array');

          this.group_select && this.group_select.setDefaultOptions(
            this.groupsList, 'Select group', 'group_lib', null, 'list', this.groupsListMap);
        },
        error => this.toastr.error(error.message || 'Groups list loading failed!', 'Oops!'));
  }

  private getResourcesList() {
    this.notebook.type = 'EXPLORATORY';
    this.notebook.title = `${this.notebook.name} <em class="capt">notebook</em>`;
    return [this.notebook].concat(this.notebook.resources
      .filter(item => item.status === 'running')
      .map(item => {
        item['name'] = item.computational_name;
        item['title'] = `${item.computational_name} <em class="capt">cluster</em>`;
        item['type'] = 'СOMPUTATIONAL';
        return item;
      }));
  }

  public filterList(): void {
    this.validity_format = '';
    (this.query && this.query.length >= 2 && this.group && !this.selectedLib) ? this.getFilteredList() : this.filteredList = null;
  }

  public filterGroups(groupsList) {
    const PREVENT_TEMPLATES = ['rstudio', 'rstudio with tensorflow'];
    const CURRENT_TEMPLATE = this.notebook.template_name.toLowerCase();
    const templateCheck = PREVENT_TEMPLATES.some(template => CURRENT_TEMPLATE.indexOf(template) !== -1);

    const filteredGroups = templateCheck ? groupsList.filter(group => group !== 'java') : groupsList;
    return SortUtils.libGroupsSort(filteredGroups);
  }

  public onUpdate($event) {
    if ($event.model.type === 'group_lib') {
      this.libSearch.enable();
      this.group = $event.model.value;
    } else if ($event.model.type === 'destination') {
      this.resetDialog();
      this.destination = $event.model.value;
      this.destination && this.destination.type === 'СOMPUTATIONAL'
        ? this.model.computational_name = this.destination.name
        : this.model.computational_name = null;
      this.uploadLibGroups();
      this.getInstalledLibsByResource();
      this.libSearch.disable();
    }
    this.filterList();
  }

  public onFilterUpdate($event) {
    this.filterModel[$event.type] = $event.model;
  }

  public isDuplicated(item) {
    if (this.filteredList) {
      if (this.group !== 'java') {
        this.selectedLib = this.filteredList.find(lib => lib.name === item.name);
      } else {
        this.selectedLib = this.filteredList.find(lib => {
          return lib.name === item.name.substring(0, item.name.lastIndexOf(':'));
        });
      }
    } else {
      this.selectedLib = null;
    }

    if (this.selectedLib) {
      this.filteredList = null;
    }
  }

  public addLibrary(item): void {
    if (this.selectedLib && !this.selectedLib.isInSelectedList) {
      this.model.selectedLibs.push({ group: this.group, name: item.name, version: item.version || 'N/A' });
      this.query = '';
      this.libSearch.setValue('');
      this.lib = {name: '', version: ''};
      this.filteredList = null;
    }
  }

  public selectLibrary(item): void {
    if (item.isInSelectedList) {
      return;
    }
    if (this.group === 'java') {
      this.libSearch.setValue(item.name + ':' + item.version);
      this.lib.name = item.name + ':' + item.version;
    } else {
      this.libSearch.setValue(item.name);
      this.lib.name = item.name;
    }
    this.matAutoComplete.closePanel();
  }

  public removeSelectedLibrary(item): void {
    this.model.selectedLibs.splice(this.model.selectedLibs.indexOf(item), 1);
    this.getMatchedLibs();
  }

  public open(notebook): void {
    this.notebook = notebook;
    this.destination = this.getResourcesList()[0];
    this.model = new InstallLibrariesModel(notebook,
      response => {
        if (response.status === HTTP_STATUS_CODES.OK) {
          this.getInstalledLibrariesList();
          this.resetDialog();
        }
      },
      error => this.toastr.error(error.message || 'Library installation failed!', 'Oops!'),
      () => {
        this.getInstalledLibrariesList(true);
        this.changeDetector.detectChanges();
        this.selectorsReset();
      },
      this.librariesInstallationService);
 }

  public showErrorMessage(item): void {
    const dialogRef: MatDialogRef<ErrorLibMessageDialogComponent> = this.dialog.open(
      ErrorLibMessageDialogComponent, { data: item.error, width: '550px', panelClass: 'error-modalbox' });
  }

  public isInstallingInProgress(): void {
    this.installingInProgress = this.notebookLibs.some(lib => lib.filteredStatus.some(status => status.status === 'installing'));
      if (this.installingInProgress) {
        window.clearTimeout(this.loadLibsTimer);
        this.loadLibsTimer = window.setTimeout(() => this.getInstalledLibrariesList(), 10000);
      }
    }

  public reinstallLibrary(item, lib) {
    const retry = [{ group: lib.group, name: lib.name, version: lib.version }];

    if (this.getResourcesList().find(el => el.name === item.resource).type === 'СOMPUTATIONAL') {
      this.model.confirmAction(retry, item.resource);
    } else {
      this.model.confirmAction(retry);
    }
  }

  private getInstalledLibrariesList(init?: boolean) {
    this.model.getInstalledLibrariesList(this.notebook)
      .subscribe((data: any) => {
        if ( !this.filtredNotebookLibs.length || data.length !== this.notebookLibs.length) {
          this.filtredNotebookLibs = [...data];
        }
        this.filtredNotebookLibs = data.filter(lib =>
          this.filtredNotebookLibs.some(v =>
            (v.name + v.version === lib.name + v.version) && v.resource === lib.resource));
        this.notebookLibs = data ? data : [];
        this.notebookLibs.forEach(lib => {
          lib.filteredStatus = lib.status;
          if (lib.version && lib.version !== 'N/A')
            lib.version = 'v.' +  lib.version;
          }
        );
        this.filterLibs();
        this.changeDetector.markForCheck();
        this.filterConfiguration.group = this.createFilterList(this.notebookLibs.map(v => this.groupsListMap[v.group]));
        this.filterConfiguration.resource = this.createFilterList(this.notebookLibs.map(lib => lib.status.map(status => status.resource)));
        this.filterConfiguration.resourceType = this.createFilterList(this.notebookLibs.map(lib =>
          lib.status.map(status => status.resourceType)));
        this.filterConfiguration.status = this.createFilterList(this.notebookLibs.map(lib => lib.status.map(status => status.status)));
        this.isInstallingInProgress();
      });
  }

  public createFilterList(array): [] {
    return array.flat().filter((v, i, arr) => arr.indexOf(v) === i);
  }

  private getInstalledLibsByResource() {
    this.librariesInstallationService.getInstalledLibsByResource(this.notebook.project, this.notebook.name, this.model.computational_name)
      .subscribe((data: any) => this.destination.libs = data);
  }

  private libsUploadingStatus(groupsList): void {
    if (groupsList.length) {
      this.groupsList = this.filterGroups(groupsList);
      this.libs_uploaded = true;
      this.uploading = false;
    } else {
      this.libs_uploaded = false;
      this.uploading = true;
      this.clear = window.setTimeout(() => this.uploadLibGroups(), this.CHECK_GROUPS_TIMEOUT);
    }
  }

  private getFilteredList(): void {
    this.validity_format = '';

    if (this.group === 'java') {
      this.model.getDependencies(this.query)
        .subscribe(
          libs => {
            this.filteredList = [libs];
            this.filteredList.forEach(lib => {
              lib.isInSelectedList = this.model.selectedLibs.some(el => lib.name === el.name.substring(0, el.name.lastIndexOf(':')));
              lib.isInstalled = this.notebookLibs.some(libr => {
              // && lib.version === item.name.substring(item.name.lastIndexOf(':') + 1
                return  lib.name === libr.name.substring(0, libr.name.lastIndexOf(':')) &&
                this.group === libr.group &&
                libr.status.some(res => res.resource === this.destination.name);
              }
             );
            });
            this.isDuplicated(this.lib);
          },
          error => {
            if (error.status === HTTP_STATUS_CODES.NOT_FOUND
              || error.status === HTTP_STATUS_CODES.BAD_REQUEST
              || error.status === HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR) {
              this.validity_format = error.message;
              this.filteredList = null;
            }
          });
    } else {
       this.getMatchedLibs();
    }
  }

  private getMatchedLibs() {
    if (this.query.length > 1) {
      this.model.getLibrariesList(this.group, this.query)
        .subscribe((libs: Library[]) => {
          this.isLibExist = libs.some(v => v.name === this.query);
          this.filteredList = libs;
          this.filteredList.forEach(lib => {
            lib.isInSelectedList = this.model.selectedLibs.some(el => el.name === lib.name);
            lib.isInstalled = this.notebookLibs.some(libr => lib.name === libr.name &&
              this.group === libr.group &&
              libr.status.some(res => res.resource === this.destination.name));
          });
          this.isDuplicated(this.lib);
        });
    }
  }

  private selectorsReset(): void {
    this.destination = this.getResourcesList()[0];
    this.uploadLibGroups();
    this.getInstalledLibsByResource();
  }

  private resetDialog(): void {
    this.group = '';
    this.query = '';
    this.libSearch.setValue('');
    this.isInstalled = false;
    this.isInSelectedList = false;
    this.uploading = false;
    this.model.selectedLibs = [];
    this.filteredList = [];
    this.groupsList = [];

    clearTimeout(this.clear);
    clearTimeout(this.loadLibsTimer);
    this.selectorsReset();
  }

  public toggleFilterRow(): void {
    this.filtered = !this.filtered;
  }

  public filterLibs(): void {
    this.filtredNotebookLibs = this.notebookLibs.filter((lib) => {
      const isName = this.filterModel.name ?
        lib.name.toLowerCase().indexOf(this.filterModel.name.toLowerCase().trim()) !== -1
        || lib.version.indexOf(this.filterModel.name.toLowerCase().trim()) !== -1 : true;
      const isGroup = this.filterModel.group.length ? this.filterModel.group.includes(this.groupsListMap[lib.group]) : true;
      lib.filteredStatus = lib.status.filter(status => {
        const isResource = this.filterModel.resource.length ? this.filterModel.resource.includes(status.resource) : true;
        const isResourceType = this.filterModel.resourceType.length ? this.filterModel.resourceType.includes(status.resourceType) : true;
        const isStatus = this.filterModel.status.length ? this.filterModel.status.includes(status.status) : true;
        return isResource && isResourceType && isStatus;
      });
      return isName && isGroup && lib.filteredStatus.length;
    });
  }

  public resetFilterConfigurations(): void {
    this.notebookLibs.forEach(v => v.filteredStatus = v.status);
    this.filtredNotebookLibs = [...this.notebookLibs];
    this.filterModel.resetFilterLibs();
  }

  public openLibInfo(lib, type) {
    this.dialog.open(
      LibInfoDialogComponent, { data: {lib, type}, width: '550px', panelClass: 'error-modalbox' });
  }

  public emitClick() {
      this.matAutoComplete.closePanel();
  }
}

@Component({
  selector: 'error-message-dialog',
  template: `
  <div class="dialog-header">
    <h4 class="modal-title">Library installation error</h4>
    <button type="button" class="close" (click)="dialogRef.close()">&times;</button>
  </div>
  <div class="content lib-error" >
    {{ data }}
  </div>
  <div class="text-center">
    <button type="button" class="butt" mat-raised-button (click)="dialogRef.close()">Close</button>
  </div>
  `,
  styles: [    `
      .lib-error { max-height: 200px; overflow-x: auto; word-break: break-all; padding: 20px 30px !important; margin: 20px 0;}
  `
  ]
})
export class ErrorLibMessageDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ErrorLibMessageDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {

  }
}

@Component({
  selector: 'lib-info-dialog',
  template: `
  <div class="dialog-header">
    <h4 class="modal-title" *ngIf="data.type === 'added'">Installed dependency</h4>
    <h4 class="modal-title" *ngIf="data.type === 'available'">Version is not available</h4>
    <button type="button" class="close" (click)="dialogRef.close()">&times;</button>
  </div>
<!--  <mat-list class="resources">-->

<!--    <mat-list-item class="list-header">-->
<!--      <div class="object">Name</div>-->
<!--      <div class="size">Version</div>-->
<!--    </mat-list-item>-->

<!--    <div class="scrolling-content delete-list" id="scrolling">-->

<!--      <mat-list-item *ngFor="let lib of data.add_pkgs" class="delete-item">-->
<!--        <div class="object">-->
<!--         {{lib}}-->
<!--        </div>-->
<!--        <div class="size">v2.3.4</div>-->
<!--      </mat-list-item>-->

<!--    </div>-->
<!--  </mat-list>-->

  <div class="lib-list" *ngIf="data.type === 'added'">
    <span class="strong dependency-title">Dependency: </span><span class="packeges" *ngFor="let pack of data.lib.add_pkgs; index as i">{{pack + (i !== data.lib.add_pkgs.length - 1 ? ', ' : '')}}</span>
  </div>
  <div class="lib-list" *ngIf="data.type === 'available'">
    <span class="strong">Available versions: </span>{{data.lib.available_versions.join(', ')}}
  </div>
  `,
  styles: [    `
    .lib-list { max-height: 200px; overflow-x: auto; word-break: break-all; padding: 20px 30px !important; margin: 20px 0; color: #577289;}
    .packeges { padding-left: 7px; line-height: 23px;}
    .dependency-title{ line-height: 23px; }
  `
  ]
})
export class LibInfoDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ErrorLibMessageDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {

  }
}
