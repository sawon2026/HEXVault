package com.hexvault.plugin.actions

import com.hexvault.plugin.services.HexVaultClientService
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.ui.Messages

class AskHexVaultAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val question = Messages.showInputDialog(project, "Ask HEXVault (uses project memory):", "Ask HEXVault", null) ?: return
        if (question.isBlank()) return
        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                val result = service<HexVaultClientService>().chat(question.trim())
                ApplicationManager.getApplication().invokeLater {
                    Messages.showInfoMessage(
                        project,
                        (result.answer ?: "(empty)") + if (result.source != null) "\n\n— source: ${result.source}" else "",
                        "HEXVault Answer",
                    )
                }
            } catch (ex: Exception) {
                ApplicationManager.getApplication().invokeLater {
                    Messages.showErrorDialog(project, ex.message ?: "Chat failed", "HEXVault")
                }
            }
        }
    }
}
