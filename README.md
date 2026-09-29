# Cinnamon-roll demand: an overfitting demonstration

Open `index.html` through a local static server, or use the GitHub Pages URL. No build or dependencies are needed. The app generates simulated hourly demand, fits nested polynomial regressions of degrees 1–15, and plots training and independent test RMSE.

For a local preview from this folder:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

The URL query string saves the sample size, noise, degree and random seed. Use **Copy run summary** to record a run for the assignment audit. These are simulated data, not Zeit für Brot sales.

The opening run uses 30 observations, volatility 9 and seed 123. It makes the rise in test error visible while preserving the same independent test set for all polynomial degrees. **Load example settings** restores that run after changing controls or opening an older saved URL. Other seeds can show a smaller or larger rise.
