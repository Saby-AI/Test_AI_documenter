import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.remote.RemoteWebDriver;
import org.openqa.selenium.interactions.Actions;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;
/**
 * This class provides automated testing capabilities for Gmail email workflows
 * using Selenium WebDriver. It includes methods to log in, compose and verify
 * drafts, and send emails.
 */
public class GmailEmailWorkflowTest {
    private WebDriver driver;
    /**
     * Constructor for the GmailEmailWorkflowTest class.
     * Initializes the WebDriver instance with specific Chrome options.
     * @throws Exception if unable to initialize the Selenium WebDriver
     */
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
    /**
     * Logs into the Gmail account using provided email and password.
     * @param email The email address to use for login.
     * @param password The password associated with the email address.
     * @throws InterruptedException if the thread is interrupted during sleep.
     */
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