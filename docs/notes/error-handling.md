# Error handling

This document outlines how this food tracker handles or should handle errors.

## Model

First of all, everything is gonna be a lognormal distribution unless stated otherwise, since this is
a reasonable probability distribution that goes from $0$ to $\infty$.

### Ingredient (food) ID

The ingredient ID is composed by:
- Name
- Brand
- Any extra attribute

This defines the pool from which the ingredients are drawn.

### Nutritional labels

Nutritional labels are assumed to be a measurement over a sample whose amount is the reference
amount, measured within instrumental error. The label consists of the amounts for each reported
nutrient, amounts that are each measured within instrumental error as well.

Let:
- $w_r$ the reference amount, variance is instrumental error
- $w_{r\alpha}$ the amount of nutrient $\alpha$ measured in the reference sample, variance is
- $q_{r\alpha}=w_{r\alpha}/w_r$ the fraction of the total weight that corresponds to nutrient
  $\alpha$

A deepresearch on the actual variance to be expected ([report](./reports/Nutrient content variability.md))
found that the reported $q_{r\alpha}$ has *somewhat* consistent errors and biases on different
product categories. Between-countries datasets are an issue tho.

We'll model this by assuming every ingredient ID is one sample which, for every nutrient, draws a
$q_\alpha$ from a lognormal distribution with mean $(1+\varepsilon_{q\alpha})q_{r\alpha}$ and
standard deviation $\varepsilon_{\delta q\alpha}(1+\varepsilon_{q\alpha})q_{r\alpha}$,
where $\varepsilon_{q\alpha}$ and $\varepsilon_{\delta q\alpha}$ are constants that depend on
category and nutrient.

Let
- $\hat{q}_\alpha=(1+\varepsilon_{q\alpha})q_{r\alpha}$
- $\hat{\delta q}_\alpha=\varepsilon_{\delta_q\alpha}\hat{q}_\alpha$

Every entry also has its own entry error $\varepsilon_e$, set per ingredient ID: how far the ID may be from
what was actually eaten. Default 10%, 0 if read off the product's own label.

### Ingredient combination

#### Same ingredient

When registering the same ingredient in different entries, it may either be the same sample eaten in
portions —such as industrial yogurt or many portions of an apple— or different samples —such as two
bananas eaten at a different time—.

It may also happen that the same entry corresponds to many samples, such as eating many mandarin
oranges at once.

Strictly, when they come from exactly the same sample, the instrumental errors add but, the sample
being the same, the sampling variance is the same over the whole combination. This scales the error
proportional to the number of portions.

When they come from different samples, each sample has its own variance. Since they are assumed
identically independently distributed, their variances add linearly (standard deviations do a
quadrature sum). This scales proportional to the square root of the number of portions.

Entries of the same ingredient ID are taken as the same sample: their sampling errors add up linearly.
Same for a concoction's portions. Entry errors are independent.

#### Diferent ingredients

Their variances just combine through addition, which scales as the square root of
ingredients.

## Math

For absolute simplicity, we'll operate over means and deviations, and slap on a lognormal
distribution at the end.

For one atomic entry (i.e., not the composition of many ingredients):
- $w_\alpha = w \hat{q}_\alpha$ is the mean
- $\delta s_\alpha = w \hat{\delta q}_\alpha$ is the sample's deviation
- ${\delta e_\alpha}^2 = {\hat{q}_\alpha}^2 {\delta w}^2 + {\delta w}^2 {\hat{\delta q}_\alpha}^2 + \varepsilon_e^2 w^2 {\hat{q}_\alpha}^2$
  is the entry's own variance, $\delta w$ being the scale's error
- ${\delta w_\alpha}^2 = {\delta s_\alpha}^2 + {\delta e_\alpha}^2$

For entries $i$ of the same sample, sample deviations add linearly:
- $w_\alpha = \sum_i w_{i\alpha}$
- ${\delta w_\alpha}^2 = \left(\sum_i \delta s_{i\alpha}\right)^2 + \sum_i {\delta e_{i\alpha}}^2$

For everything else, variances add:
- $w_\alpha = \sum_i w_{i\alpha}$
- ${\delta w_\alpha}^2 = \sum_i {\delta w_{i\alpha}}^2$

A concoction of total weight $P$ is just a sample with $\hat{q}_\alpha = w_\alpha/P$ and
$\hat{\delta q}_\alpha = \delta w_\alpha/P$, $w_\alpha$ and $\delta w_\alpha$ from its ingredients. Its
portions are entries of the same sample, all of $\delta w_\alpha$ being its sample deviation.

At the end, a mean $m$ and deviation $s$ become a lognormal with:
- $\sigma^2 = \ln(1 + s^2/m^2)$
- $\mu = \ln m - \sigma^2/2$
