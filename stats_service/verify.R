# =====================================================================
# MODULE 4 — Script R THAM KHẢO để đối chiếu độc lập với stats_service
# ---------------------------------------------------------------------
# LƯU Ý QUAN TRỌNG: Môi trường phát triển hiện tại KHÔNG có R cài đặt,
# nên script này CHƯA được chạy thực tế. Đây là script THAM KHẢO, viết
# đúng theo đặc tả method luận (glm binomial, pROC, chisq.test,
# fisher.test, prop.trend.test) để người có R/RStudio chạy đối chiếu
# sau. Xem stats_service/VERIFICATION.md để biết cách đối chiếu độc lập
# ĐÃ THỰC HIỆN được trong môi trường hiện tại (tính tay bằng numpy).
#
# Cách chạy (khi có R):
#   Rscript verify.R
# Yêu cầu cài: install.packages(c("pROC"))
# =====================================================================

df <- read.csv("verify_dataset.csv", stringsAsFactors = FALSE)
df$nhom_uu_tien <- factor(df$nhom_uu_tien, levels = c("thap", "tb", "tb_cao", "cao"), ordered = TRUE)

cat("========================================\n")
cat("(a) BANG CHEO & CHI-SQUARE\n")
cat("========================================\n")
tab <- table(df$nhom_uu_tien, df$khong_dat)
print(tab)

chi_res <- chisq.test(tab, correct = FALSE)
cat(sprintf("Chi-square = %.6f, df = %d, p = %.3e\n", chi_res$statistic, chi_res$parameter, chi_res$p.value))
cat("Bang tan so ky vong:\n")
print(chi_res$expected)

if (min(chi_res$expected) < 5) {
  cat("\nCanh bao: co o ky vong < 5 -> dung Fisher exact test thay the:\n")
  fisher_res <- fisher.test(tab)
  print(fisher_res)
}

cat("\n--- Cochran-Armitage trend test (prop.trend.test) ---\n")
n_khong_dat_by_group <- as.vector(tab[, "1"])
n_total_by_group <- as.vector(rowSums(tab))
trend_res <- prop.trend.test(n_khong_dat_by_group, n_total_by_group)
print(trend_res)

cat("\n========================================\n")
cat("(b) HOI QUY LOGISTIC (glm family=binomial, MLE)\n")
cat("========================================\n")

cat("--- Don bien: khong_dat ~ R ---\n")
model_uni <- glm(khong_dat ~ R, data = df, family = binomial(link = "logit"))
print(summary(model_uni))
or_uni <- exp(coef(model_uni)["R"])
ci_uni <- exp(confint(model_uni)["R", ])
cat(sprintf("OR = %.4f, 95%% CI = [%.4f, %.4f]\n", or_uni, ci_uni[1], ci_uni[2]))

cat("\n--- Da bien: khong_dat ~ KN01 + KN06 ---\n")
model_multi <- glm(khong_dat ~ KN01 + KN06, data = df, family = binomial(link = "logit"))
print(summary(model_multi))
or_multi <- exp(coef(model_multi))
ci_multi <- exp(confint(model_multi))
print(cbind(OR = or_multi, ci_multi))

# Pseudo R2 (McFadden)
null_model <- glm(khong_dat ~ 1, data = df, family = binomial())
mcfadden_r2 <- 1 - as.numeric(logLik(model_multi)) / as.numeric(logLik(null_model))
cat(sprintf("\nMcFadden pseudo-R2 (da bien) = %.4f\n", mcfadden_r2))

# VIF (can package car, hoac tinh tay qua 1/(1-R^2) hoi quy phu)
if (requireNamespace("car", quietly = TRUE)) {
  cat("\nVIF:\n")
  print(car::vif(model_multi))
} else {
  cat("\n(Goi y: cai package 'car' de tinh VIF: install.packages('car'))\n")
}

cat("\n========================================\n")
cat("(c) ROC / AUC (pROC package)\n")
cat("========================================\n")
if (requireNamespace("pROC", quietly = TRUE)) {
  library(pROC)
  roc_obj <- roc(df$khong_dat, df$R, ci = TRUE, quiet = TRUE)
  print(roc_obj)
  cat(sprintf("AUC = %.4f, 95%% CI = [%.4f, %.4f]\n", auc(roc_obj), ci(roc_obj)[1], ci(roc_obj)[3]))

  youden_res <- coords(roc_obj, "best", best.method = "youden",
                        ret = c("threshold", "sensitivity", "specificity"))
  print(youden_res)
} else {
  cat("Can cai package 'pROC': install.packages('pROC')\n")
}

cat("\n--- Mann-Whitney U (wilcox.test) ---\n")
wt <- wilcox.test(R ~ khong_dat, data = df)
print(wt)

cat("\n========================================\n")
cat("HOAN TAT. So sanh cac so lieu tren voi verify_output.json / VERIFICATION.md\n")
cat("========================================\n")
