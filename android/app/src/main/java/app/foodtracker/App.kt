package app.foodtracker

import android.app.Application
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import app.foodtracker.data.FoodDb
import app.foodtracker.data.Repo
import app.foodtracker.ui.ConfigScreen
import app.foodtracker.ui.ConsumptionsScreen
import app.foodtracker.ui.DialogHost
import app.foodtracker.ui.Dialogs
import app.foodtracker.ui.ExternalScreen
import app.foodtracker.ui.FoodEditScreen
import app.foodtracker.ui.FoodListScreen
import app.foodtracker.ui.FoodTheme
import app.foodtracker.ui.HomeScreen
import app.foodtracker.ui.LocalDialogs
import app.foodtracker.ui.Nav
import app.foodtracker.ui.Route
import app.foodtracker.ui.TargetsScreen
import app.foodtracker.ui.UsersScreen

class FoodApp : Application() {
    val repo by lazy { Repo(FoodDb.open(this)) }
}

/** Holds the back stack across configuration changes. */
class MainViewModel(app: Application) : AndroidViewModel(app) {
    val nav = Nav()
}

val LocalRepo = staticCompositionLocalOf<Repo> { error("no repo") }
val LocalNav = staticCompositionLocalOf<Nav> { error("no nav") }

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val repo = (application as FoodApp).repo
        setContent {
            val nav = viewModel<MainViewModel>().nav
            AppRoot(repo, nav)
        }
    }
}

@Composable
fun AppRoot(repo: Repo, nav: Nav) {
    val dialogs = remember { Dialogs() }
    FoodTheme {
        CompositionLocalProvider(LocalRepo provides repo, LocalNav provides nav, LocalDialogs provides dialogs) {
            BackHandler(enabled = nav.stack.size > 1) { nav.back() }
            when (val r = nav.top) {
                Route.Home -> HomeScreen()
                Route.Users -> UsersScreen()
                Route.Foods -> FoodListScreen()
                Route.Targets -> TargetsScreen()
                Route.Config -> ConfigScreen()
                is Route.Consumptions -> ConsumptionsScreen(r)
                is Route.FoodEdit -> FoodEditScreen(r)
                is Route.External -> ExternalScreen(r)
            }
            DialogHost(dialogs)
        }
    }
}
