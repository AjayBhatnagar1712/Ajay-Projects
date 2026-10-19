public class while_loop {
    public static void main(String[] args) {
        int i = 1;
        while (i<=3){
            System.out.println(i);
            i=++i;
        }
        System.out.println("End of while loop");

        // Program 2
        int  n = 100 ;
        while (n >= 100 && n <= 200){
            System.out.println(n);
            n++;
        }
        System.out.println("End of the second loop");
    }
}