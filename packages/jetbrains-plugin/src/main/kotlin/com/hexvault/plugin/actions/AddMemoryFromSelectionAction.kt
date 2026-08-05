package com.hexvault.plugin.actions

import com.hexvault.plugin.services.HexVaultClientService
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.ui.Messages

class AddMemoryFromSelectionAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val editor = e.getData(CommonDataKeys.EDITOR) ?: run {
            Messages.showWarningDialog(project, "Open a file and select text first.", "HEXVault")
            return
        }
        val selection = editor.selectionModel.selectedText?.trim().orEmpty()
        if (selection.isBlank()) {
            Messages.showWarningDialog(project, "Select some text in the editor first.", "HEXVault")
            return
        }
        val title = Messages.showInputDialog(project, "Memory title (optional):", "Add to HEXVault", null, selection.take(60), null) ?: return
        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                service<HexVaultClientService>().addMemory(selection, title.ifBlank { null }, "note", listOf("jetbrains"))
                ApplicationManager.getApplication().invokeLater {
                    Messages.showInfoMessage(project, "Memory saved to HEXVault.", "HEXVault")
                }
            } catch (ex: Exception) {
                ApplicationManager.getApplication().invokeLater {
                    Messages.showErrorDialog(project, ex.message ?: "Failed to save memory", "HEXVault")
                }
            }
        }
    }

    override fun update(e: AnActionEvent) {
        val editor = e.getData(CommonDataKeys.EDITOR)
        e.presentation.isEnabled = editor != null && !editor.selectionModel.selectedText.isNullOrBlank()
    }
}
