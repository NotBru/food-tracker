package app.foodtracker

import app.foodtracker.data.Component
import app.foodtracker.data.Ctx
import app.foodtracker.data.Item
import app.foodtracker.data.Log
import app.foodtracker.data.Nutrient
import app.foodtracker.data.Range
import app.foodtracker.data.Status
import app.foodtracker.data.Target
import app.foodtracker.data.UnitConv
import app.foodtracker.data.Window
import app.foodtracker.data.calories
import app.foodtracker.data.consumptionNutrients
import app.foodtracker.data.deltaFromInput
import app.foodtracker.data.fmt
import app.foodtracker.data.isoOf
import app.foodtracker.data.jsNumber
import app.foodtracker.data.jsString
import app.foodtracker.data.logicalDay
import app.foodtracker.data.measure
import app.foodtracker.data.nutrientsFor
import app.foodtracker.data.rangeLabel
import app.foodtracker.data.sumNutrients
import app.foodtracker.data.targetBar
import app.foodtracker.data.unitFactor
import app.foodtracker.data.unitsFor
import app.foodtracker.data.windowDays
import app.foodtracker.data.windowTargets
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.BeforeClass
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.TimeZone

/** The numbers checked by hand for the web app (docs/execution/2026-10-15-error-bars.md), on the Kotlin port. */
class CalcTest {
    companion object {
        @JvmStatic @BeforeClass fun zone() = TimeZone.setDefault(TimeZone.getTimeZone("Europe/Paris"))
    }

    private fun n(v: Double, d: Double = 0.0) = Nutrient(v, d)
    private val eps = 1e-9

    // Bread: 250 kcal per 100 g (exact), 1 slice = 30 ± 5 g.
    private val bread = Item(
        id = 1, name = "Bread", amount = 100.0, unit = "g",
        units = listOf(UnitConv(fromAmount = 1.0, fromUnit = "slice", toAmount = 30.0, toDelta = 5.0, toUnit = "g")),
        nutrients = mapOf("energy" to n(250.0), "proteins" to n(9.0), "fat" to n(3.0), "carbohydrates" to n(50.0)),
    )
    // Toast: 1 portion = 2 ± 0.5 slices of bread.
    private val toast = Item(id = 2, name = "Toast", components = listOf(Component(itemId = 1, amount = 2.0, amountDelta = 0.5, unit = "slice")))
    private val ctx = Ctx(listOf(bread, toast))

    @Test fun oneSlice() {
        val r = nutrientsFor(ctx, 1, 1.0, "slice")
        assertTrue(r.ok)
        assertEquals(75.0, r.nutrients.getValue("energy").value, eps)
        assertEquals(12.5, r.nutrients.getValue("energy").delta, eps)
    }

    @Test fun recipeOfSlices() {
        val r = nutrientsFor(ctx, 2, 1.0, "portion")
        assertEquals(150.0, r.nutrients.getValue("energy").value, eps)
        assertEquals(68.75, r.nutrients.getValue("energy").delta, eps) // 25–35 g × 1.5–2.5
    }

    @Test fun perAmountWithError() {
        val food = Item(id = 3, amount = 100.0, amountDelta = 10.0, unit = "g", nutrients = mapOf("energy" to n(100.0)))
        val r = nutrientsFor(Ctx(listOf(food)), 3, 100.0, "g")
        assertEquals(100.0, r.nutrients.getValue("energy").value, eps)
        assertEquals(11.1, r.nutrients.getValue("energy").delta, 0.05)
    }

    @Test fun consumptionAndTargets() {
        // 700 ± 50 kcal, P 35 ± 2 per 100 g; eating 300 ± 5 g.
        val food = Item(id = 1, amount = 100.0, unit = "g", nutrients = mapOf(
            "energy" to n(700.0, 50.0), "proteins" to n(35.0, 2.0), "fat" to n(30.0, 1.0), "carbohydrates" to n(70.0, 2.0),
        ))
        val r = consumptionNutrients(Ctx(listOf(food)), Log(itemId = 1, amount = 300.0, amountDelta = 5.0, unit = "g"))
        val kcal = r.nutrients.getValue("energy")
        assertEquals(2100.0, kcal.value, eps)
        assertEquals(187.5, kcal.delta, eps)
        val p = r.nutrients.getValue("proteins")
        assertEquals(105.0, p.value, eps)
        assertEquals(7.85, p.delta, 1e-6)
        assertEquals(Status.Over, targetBar(kcal.value, Range(1800.0, 2200.0), kcal.delta)!!.status)
        assertEquals(Status.Under, targetBar(p.value, Range(min = 100.0), p.delta)!!.status)
        assertEquals(Status.Ok, targetBar(90.0, Range(max = 100.0), 4.5)!!.status)
    }

    @Test fun barGeometry() {
        val b = targetBar(50.0, Range(max = 100.0))!!
        assertEquals(80.0, b.maxAt!!, eps)
        assertEquals(40.0, b.fill, eps)
        val m = targetBar(50.0, Range(min = 100.0))!!
        assertEquals(50.0, m.minAt!!, eps)
    }

    @Test fun unitConversions() {
        assertEquals(1000.0, unitFactor("kg", "g"), eps)
        assertEquals(0.03, unitFactor("slice", "kg", bread.units), eps)
        assertTrue(unitFactor("cup", "g").isNaN())
        assertEquals("g", unitsFor(ctx, 1).first())
        assertTrue("slice" in unitsFor(ctx, 1))
        assertFalse("ml" in unitsFor(ctx, 1))
        assertFalse(nutrientsFor(ctx, 1, 1.0, "cup").ok)
    }

    @Test fun recipeCycleIsNotOk() {
        val a = Item(id = 1, components = listOf(Component(itemId = 2, amount = 1.0, unit = "portion")))
        val b = Item(id = 2, components = listOf(Component(itemId = 1, amount = 1.0, unit = "portion")))
        assertFalse(nutrientsFor(Ctx(listOf(a, b)), 1, 1.0, "portion").ok)
    }

    @Test fun caloriesEstimateAndMissing() {
        val noKcal = Item(id = 1, amount = 1.0, unit = "portion", nutrients = mapOf("proteins" to n(10.0), "fat" to n(1.0), "carbohydrates" to n(20.0), "fibers" to n(Double.NaN)))
        val r = nutrientsFor(Ctx(listOf(noKcal)), 1, 1.0, "portion")
        val k = calories(r.nutrients)
        assertEquals(129.0, k.value, eps)
        assertTrue(r.nutrients.getValue("energy").estimated)
        assertTrue(r.nutrients.getValue("fibers").missing)
        val total = sumNutrients(listOf(r.nutrients, r.nutrients))
        assertEquals(258.0, total.getValue("energy").value, eps)
        assertTrue(total.getValue("fibers").missing)
    }

    @Test fun digitsAndFormatting() {
        assertEquals(0.1, deltaFromInput("59.8"), eps)
        assertEquals(1.0, deltaFromInput("12"), eps)
        assertEquals(0.1, deltaFromInput("3."), eps)
        assertTrue(deltaFromInput("abc").isNaN())
        val m = measure("250", "")
        assertEquals(250.0, m.value, eps); assertEquals(1.0, m.delta, eps); assertTrue(m.auto)
        val m2 = measure("1.50", " 0.2")
        assertEquals(0.2, m2.delta, eps); assertFalse(m2.auto); assertEquals("1.50", m2.text)
        assertEquals("2.3", fmt(2.25))
        assertEquals("1", fmt(1.005, 2))
        assertEquals("150", fmt(149.6))
        assertEquals("–", fmt(Double.NaN))
        assertEquals("100", jsString(100.0))
        assertEquals("0.1", jsString(0.1))
        assertEquals(0.0, jsNumber(""), eps)
        assertTrue(jsNumber("1d").isNaN())
        assertEquals("1800–2200", rangeLabel(Range(1800.0, 2200.0)))
        assertEquals("≥ 120", rangeLabel(Range(min = 120.0)))
        assertEquals("≤ 2300", rangeLabel(Range(max = 2300.0)))
    }

    @Test fun logicalDaysAndWindows() {
        val at2am = isoOf(LocalDateTime.of(2026, 10, 16, 2, 0))
        assertEquals(LocalDate.of(2026, 10, 15), logicalDay(at2am, "05:00"))
        assertEquals(LocalDate.of(2026, 10, 16), logicalDay(at2am, "00:00"))
        val thu = LocalDate.of(2026, 10, 15)
        assertEquals(LocalDate.of(2026, 10, 12) to LocalDate.of(2026, 10, 18), windowDays(Window.Weekly, thu))
        assertEquals(LocalDate.of(2026, 10, 1) to LocalDate.of(2026, 10, 31), windowDays(Window.Monthly, thu))
    }

    @Test fun targetsSumOverWindow() {
        val t1 = Target(id = 1, validFrom = isoOf(LocalDateTime.of(2026, 10, 1, 0, 0)), values = mapOf("energy" to Range(1800.0, 2200.0)))
        val t2 = Target(id = 2, validFrom = isoOf(LocalDateTime.of(2026, 10, 14, 12, 0)), values = mapOf("energy" to Range(max = 2000.0)))
        // Mon 12 – Sun 18: 12, 13 under t1; 14 (started before the day ended) to 18 under t2.
        val w = windowTargets(listOf(t1, t2), LocalDate.of(2026, 10, 12), LocalDate.of(2026, 10, 18), "05:00")
        assertEquals(3600.0, w.getValue("energy").min!!, eps)
        assertEquals(2 * 2200.0 + 5 * 2000.0, w.getValue("energy").max!!, eps)
    }
}
