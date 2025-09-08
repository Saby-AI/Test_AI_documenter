package main.java;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.remote.RemoteWebDriver;
import org.openqa.selenium.interactions.Actions;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

public class GmailEmailWorkflowTest {
    private WebDriver driver;

    public GmailEmailWorkflowTest() throws Exception {
        ChromeOptions options = new ChromeOptions();
        Map<String, Object> prefs = new HashMap<>();
        prefs.put("credentials_enable_service", false);
        prefs.put("profile.password_manager_leak_detection", false);
        prefs.put("profile.password_manager_enabled", false);
        options.setExperimentalOption("prefs", prefs);
        URL hubUrl = new URL("http://selenium:4444/wd/hub");
        driver = new RemoteWebDriver(hubUrl, options);
    }

    public void login(String email, String password) throws InterruptedException {
        driver.get("https://mail.google.com");
        Thread.sleep(3000);
        driver.findElement(By.name("identifier")).sendKeys(email);
        Thread.sleep(3000);
        driver.findElement(By.id("identifierNext")).click();
        Thread.sleep(3000);
        driver.findElement(By.name("password")).sendKeys(password);
        Thread.sleep(3000);
        driver.findElement(By.id("passwordNext")).click();
        Thread.sleep(3000);
    }

    public void composeAndSaveDraft(String recipient, String subject, String body, String attachmentPath) throws InterruptedException {
        Thread.sleep(3000);
        driver.findElement(By.xpath("//div[contains(text(), 'Compose')]"))
                .click();
        Thread.sleep(3000);
        driver.findElement(By.name("to")).sendKeys(recipient);
        Thread.sleep(3000);
        driver.findElement(By.name("subjectbox")).sendKeys(subject);
        Thread.sleep(3000);
        driver.findElement(By.xpath("//div[@aria-label='Message Body']")).sendKeys(body);
        Thread.sleep(3000);
        driver.findElement(By.xpath("//input[@type='file']")).sendKeys(attachmentPath);
        Thread.sleep(3000);
        driver.findElement(By.xpath("//div[contains(text(), 'Close')]"))
                .click();
        Thread.sleep(3000);
    }

    public void verifyDraft(String subject) throws InterruptedException {
        driver.findElement(By.xpath("//a[contains(text(), 'Drafts')]"))
                .click();
        Thread.sleep(3000);
        WebElement draftEmail = driver.findElement(By.xpath("//span[contains(text(), '" + subject + '")]"));
        scrollIntoView(draftEmail);
        Thread.sleep(3000);
        draftEmail.click();
        Thread.sleep(3000);
    }

    public void sendDraft() throws InterruptedException {
        driver.findElement(By.xpath("//div[contains(text(), 'Send')]"))
                .click();
        Thread.sleep(3000);
    }

    public void scrollIntoView(WebElement element) {
        Actions actions = new Actions(this.driver);
        actions.moveToElement(element);
        actions.perform();
    }

    public void close() {
        if (driver != null) {
            driver.quit();
        }
    }
}