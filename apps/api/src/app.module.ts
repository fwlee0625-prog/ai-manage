import { Module } from '@nestjs/common';
import { AdapterRegistry } from './adapters/adapter-registry.js';
import { CodexAdapter } from './adapters/codex.adapter.js';
import { ClaudeAdapter } from './adapters/claude.adapter.js';
import { CredentialStoreService } from './credentials/credential-store.service.js';
import { IndexRepository } from './database/index.repository.js';
import { ManageRepository } from './database/manage.repository.js';
import { PathGuard } from './fs/path-guard.js';
import { IndexingService } from './indexing/indexing.service.js';
import { ProviderImportService } from './providers/provider-import.service.js';
import { ProvidersController } from './providers/providers.controller.js';
import { ProvidersRepository } from './providers/providers.repository.js';
import { ProvidersService } from './providers/providers.service.js';
import { TrashService } from './routes/trash.service.js';
import { ConfigsController } from './routes/configs.controller.js';
import { ConfigsService } from './routes/configs.service.js';
import { FilesController } from './routes/files.controller.js';
import { FilesService } from './routes/files.service.js';
import { IndexRefreshService } from './routes/index-refresh.service.js';
import { IndexingController } from './routes/indexing.controller.js';
import { LogsService } from './routes/logs.service.js';
import { LogsController } from './routes/logs.controller.js';
import { ProjectsController } from './routes/projects.controller.js';
import { ProjectsService } from './routes/projects.service.js';
import { SessionsController } from './routes/sessions.controller.js';
import { SessionsService } from './routes/sessions.service.js';
import { SkillsController } from './routes/skills.controller.js';
import { SkillsService } from './routes/skills.service.js';
import { TerminalsController } from './routes/terminals.controller.js';
import { TerminalsService } from './routes/terminals.service.js';
import { TerminalsWebSocketServer } from './routes/terminals.websocket.js';
import { ToolsController } from './routes/tools.controller.js';
import { ToolsService } from './routes/tools.service.js';
import { TrashController } from './routes/trash.controller.js';

@Module({
  controllers: [ToolsController, ConfigsController, ProvidersController, SkillsController, SessionsController, ProjectsController, TerminalsController, FilesController, TrashController, IndexingController, LogsController],
  providers: [AdapterRegistry, CodexAdapter, ClaudeAdapter, PathGuard, IndexRepository, ManageRepository, IndexingService, TrashService, ToolsService, IndexRefreshService, ProjectsService, SessionsService, TerminalsService, TerminalsWebSocketServer, LogsService, ConfigsService, SkillsService, FilesService, CredentialStoreService, ProvidersRepository, ProvidersService, ProviderImportService],
})
export class AppModule {}
