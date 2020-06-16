/********************************************************************************
 * Copyright (C) 2017-2018 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import '../../src/browser/style/index.css';

import { ContainerModule, interfaces } from 'inversify';
import { ResourceResolver, CommandContribution } from '@theia/core/lib/common';
import { WebSocketConnectionProvider, FrontendApplicationContribution, ConfirmDialog, LabelProviderContribution, LabelProvider } from '@theia/core/lib/browser';
import { FileSystem, fileSystemPath, FileShouldOverwrite, FileStat } from '../common';
import {
    fileSystemWatcherPath, FileSystemWatcherServer,
    FileSystemWatcherServerProxy, ReconnectingFileSystemWatcherServer
} from '../common/filesystem-watcher-protocol';
import { FileResourceResolver } from './file-resource';
import { bindFileSystemPreferences } from './filesystem-preferences';
import { FileSystemWatcher } from './filesystem-watcher';
import { FileSystemFrontendContribution } from './filesystem-frontend-contribution';
import { FileSystemProxyFactory } from './filesystem-proxy-factory';
import { FileUploadService } from './file-upload-service';
import { FileTreeLabelProvider } from './file-tree/file-tree-label-provider';
import URI from '@theia/core/lib/common/uri';
import { FileService } from './file-service';
import { RemoteFileSystemProvider, RemoteFileSystemServer } from '../common/remote-file-system-provider';

export default new ContainerModule(bind => {
    bindFileSystemPreferences(bind);

    bind(FileSystemWatcherServerProxy).toDynamicValue(ctx =>
        WebSocketConnectionProvider.createProxy(ctx.container, fileSystemWatcherPath)
    );
    bind(FileSystemWatcherServer).to(ReconnectingFileSystemWatcherServer);
    bind(FileSystemWatcher).toSelf().inSingletonScope();
    bind(FileShouldOverwrite).toDynamicValue(context => async (file: FileStat, stat: FileStat): Promise<boolean> => {
        const labelProvider = context.container.get(LabelProvider);
        const dialog = new ConfirmDialog({
            title: `The file '${labelProvider.getName(new URI(file.uri))}' has been changed on the file system.`,
            msg: `Do you want to overwrite the changes made to '${labelProvider.getLongName(new URI(file.uri))}' on the file system?`,
            ok: 'Yes',
            cancel: 'No'
        });
        return !!await dialog.open();
    }).inSingletonScope();

    bind(FileSystemProxyFactory).toSelf();
    bind(FileSystem).toDynamicValue(ctx => {
        const proxyFactory = ctx.container.get(FileSystemProxyFactory);
        return WebSocketConnectionProvider.createProxy(ctx.container, fileSystemPath, proxyFactory);
    }).inSingletonScope();

    bindFileResource(bind);

    bind(FileUploadService).toSelf().inSingletonScope();

    bind(FileSystemFrontendContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(FileSystemFrontendContribution);
    bind(FrontendApplicationContribution).toService(FileSystemFrontendContribution);

    bind(FileTreeLabelProvider).toSelf().inSingletonScope();
    bind(LabelProviderContribution).toService(FileTreeLabelProvider);

    bind(RemoteFileSystemServer).toDynamicValue(ctx =>
        WebSocketConnectionProvider.createProxy(ctx.container, fileSystemWatcherPath)
    );
    bind(RemoteFileSystemProvider).toSelf().inSingletonScope();
    bind(FileService).toSelf().inSingletonScope().onActivation(({ container }, service) => {
        const provider = container.get(RemoteFileSystemProvider);
        service.registerProvider('file', provider);
        return service;
    });
});

export function bindFileResource(bind: interfaces.Bind): void {
    bind(FileResourceResolver).toSelf().inSingletonScope();
    bind(ResourceResolver).toService(FileResourceResolver);
}
