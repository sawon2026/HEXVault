package com.hexvault.plugin.actions

import com.hexvault.plugin.services.HexVaultClientService
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.wm.ToolWindowManager

class SearchMemoriesAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val query = Messages.showInputDialog(project, "Search HEXVault memories:", "HEXVault Search", null) ?: return
        if (query.isBlank()) return
        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                val result = service<HexVaultClientService>().search(query.trim())
                val text = buildString {
                    appendLine("Found ${result.count ?: 0} result(s) for \"$query\"\n")
                    result.results.orEmpty().forEachIndexed { i, hit ->
                        appendLine("${i + 1}. ${hit.title ?: hit.id} [${hit.type}]")
                        val snippet = hit.content?.take(200)?.replace("\n", " ") ?: ""
                        if (snippet.isNotBlank()) appendLine("   $snippet…")
                        appendLine()
                    }
                }
                ApplicationManager.getApplication().invokeLater {
                    Messages.showInfoMessage(project, text.ifBlank { "No results." }, "HEXVault Search")
                }
            } catch (ex: Exception) {
                ApplicationManager.getApplication().invokeLater {
                    Messages.showErrorDialog(project, ex.message ?: "Search failed", "HEXVault")
                }
            }
        }
        ToolWindowManager.getInstance(project).getToolWindow("HEXVault")?.show()
    }
}
