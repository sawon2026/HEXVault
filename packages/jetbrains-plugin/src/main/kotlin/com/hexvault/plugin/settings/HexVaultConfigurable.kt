package com.hexvault.plugin.settings

import com.intellij.openapi.options.Configurable
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBPasswordField
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.FormBuilder
import javax.swing.JComponent
import javax.swing.JPanel

class HexVaultConfigurable : Configurable {
    private val baseUrlField = JBTextField()
    private val tokenField = JBPasswordField()
    private var panel: JPanel? = null

    override fun getDisplayName(): String = "HEXVault"

    override fun createComponent(): JComponent {
        val settings = HexVaultSettings.getInstance().state
        baseUrlField.text = settings.baseUrl
        tokenField.text = settings.token
        panel = FormBuilder.createFormBuilder()
            .addLabeledComponent(JBLabel("API base URL:"), baseUrlField, 1, false)
            .addLabeledComponent(JBLabel("API token (optional):"), tokenField, 1, false)
            .addComponentFillVertically(JPanel(), 0)
            .panel
        return panel!!
    }

    override fun isModified(): Boolean {
        val s = HexVaultSettings.getInstance().state
        return baseUrlField.text != s.baseUrl || String(tokenField.password) != s.token
    }

    override fun apply() {
        val s = HexVaultSettings.getInstance().state
        s.baseUrl = baseUrlField.text.trim().trimEnd('/')
        s.token = String(tokenField.password).trim()
    }

    override fun reset() {
        val s = HexVaultSettings.getInstance().state
        baseUrlField.text = s.baseUrl
        tokenField.text = s.token
    }
}
