/**
     * Composes a new email draft with the specified recipient, subject, body, and attachment.
     * @param recipient The email address of the recipient.
     * @param subject The subject of the email.
     * @param body The body content of the email.
     * @param attachmentPath The local file path of the attachment.
     * @throws InterruptedException if the thread is interrupted during sleep.
     */
    public void composeAndSaveDraft(String recipient, String subject, String body, String attachmentPath) throws InterruptedException {
        Thread.sleep(3000);
        driver.findElement(By.xpath("//div[contains(text(), 'Compose')]")).click();
        Thread.sleep(3000);
        driver.findElement(By.name("to")).sendKeys(recipient);
        Thread.sleep(3000);
        driver.findElement(By.name("subjectbox")).sendKeys(subject);
        Thread.sleep(3000);
        driver.findElement(By.xpath("//div[@aria-label='Message Body']")).sendKeys(body);
        Thread.sleep(3000);
        driver.findElement(By.xpath("//input[@type='file']")).sendKeys(attachmentPath);
        Thread.sleep(3000);
        driver.findElement(By.xpath("//div[contains(text(), 'Close')]")).click();
        Thread.sleep(3000);
    }
    /**
     * Verifies a draft email by subject and opens it.
     * @param subject The subject of the draft email to verify and open.
     * @throws InterruptedException if the thread is interrupted during sleep.
     */
    public void verifyDraft(String subject) throws InterruptedException {
        driver.findElement(By.xpath("//a[contains(text(), 'Drafts')]")).click();
        Thread.sleep(3000);
        WebElement draftEmail = driver.findElement(By.xpath("//span[contains(text(), '" + subject + '")]"));
        scrollIntoView(draftEmail);
        Thread.sleep(3000);
        draftEmail.click();
        Thread.sleep(3000);
    }
    /**
     * Sends the currently open draft email.
     * @throws InterruptedException if the thread is interrupted during sleep.
     */
    public void sendDraft() throws InterruptedException {
        driver.findElement(By.xpath("//div[contains(text(), 'Send')]")).click();
        Thread.sleep(3000);
    }
    /**
     * Scrolls the specified WebElement into view.
     * @param element The WebElement to scroll into view.
     */
    public void scrollIntoView(WebElement element) {
        Actions actions = new Actions(this.driver);
        actions.moveToElement(element);
        actions.perform();
    }
    /**
     * Closes the WebDriver and releases resources.
     */
    public void close() {
        if (driver != null) {
            driver.quit();
        }
    }
}