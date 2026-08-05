package com.hexvault.plugin.toolwindow

import com.hexvault.plugin.services.HexVaultClientService
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.components.JBTextArea
import com.intellij.ui.components.JBTextField
import com.intellij.ui.content.ContentFactory
import java.awt.BorderLayout
import java.awt.FlowLayout
import javax.swing.JButton
import javax.swing.JPanel

class HexVaultToolWindowFactory : ToolWindowFactory, DumbAware {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel = JPanel(BorderLayout(8, 8))
        val queryField = JBTextField().apply { emptyText.text = "Search memories…" }
        val searchBtn = JButton("Search")
        val askBtn = JButton("Ask")
        val healthBtn = JButton("Health")
        val output = JBTextArea().apply { isEditable = false; lineWrap = true; wrapStyleWord = true }

        val top = JPanel(BorderLayout(4, 4))
        top.add(queryField, BorderLayout.CENTER)
        val buttons = JPanel(FlowLayout(FlowLayout.LEFT, 4, 0))
        buttons.add(searchBtn); buttons.add(askBtn); buttons.add(healthBtn)
        top.add(buttons, BorderLayout.EAST)
        panel.add(top, BorderLayout.NORTH)
        panel.add(JBScrollPane(output), BorderLayout.CENTER)

        fun runAsync(block: () -> String) {
            output.text = "Working…"
            ApplicationManager.getApplication().executeOnPooledThread {
                try {
                    val text = block()
                    ApplicationManager.getApplication().invokeLater { output.text = text }
                } catch (ex: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        output.text = "Error: ${ex.message}"
                        Messages.showErrorDialog(project, ex.message ?: "Error", "HEXVault")
                    }
                }
            }
        }

        searchBtn.addActionListener {
            val q = queryField.text.trim()
            if (q.isEmpty()) return@addActionListener
            runAsync {
                val result = service<HexVaultClientService>().search(q)
                buildString {
                    appendLine("Search: \"$q\" — ${result.count ?: 0} hits\n")
                    result.results.orEmpty().forEachIndexed { i, hit ->
                        appendLine("${i + 1}. ${hit.title} [${hit.type}]")
                        appendLine("   ${(hit.content ?: "").take(240).replace("\n", " ")}")
                        appendLine()
                    }
                }
            }
        }
        askBtn.addActionListener {
            val q = queryField.text.trim()
            if (q.isEmpty()) return@addActionListener
            runAsync {
                val r = service<HexVaultClientService>().chat(q)
                "${r.answer ?: "(no answer)"}\n\n— ${r.source ?: "unknown"}"
            }
        }
        healthBtn.addActionListener {
            runAsync { "API health: ${service<HexVaultClientService>().health()}" }
        }

        toolWindow.contentManager.addContent(ContentFactory.getInstance().createContent(panel, "", false))
    }
}
