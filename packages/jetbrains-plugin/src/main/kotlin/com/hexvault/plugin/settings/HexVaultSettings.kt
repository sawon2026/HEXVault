package com.hexvault.plugin.settings

import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.components.service

@Service(Service.Level.APP)
@State(name = "HexVaultSettings", storages = [Storage("hexvault.xml")])
class HexVaultSettings : PersistentStateComponent<HexVaultSettings.State> {
    data class State(
        var baseUrl: String = "http://127.0.0.1:3850",
        var token: String = "",
        var timeoutMs: Int = 30_000,
    )
    private var state = State()
    override fun getState(): State = state
    override fun loadState(state: State) { this.state = state }
    companion object {
        fun getInstance(): HexVaultSettings = service()
    }
}
