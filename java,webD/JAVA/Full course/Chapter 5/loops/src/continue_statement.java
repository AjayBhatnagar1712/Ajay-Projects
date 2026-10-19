public class continue_statement {
    public static void main(String[] args) {
        int j = 8;
//        for (int i = 1 ; i<j ; i++){
//            if (i == 4){
//                System.out.println("Skipping the 4th iteration");
//                continue;
//            }
//            //always write the printing command after the coninue statement so that the compiler first read the break command then the printing command.
//            System.out.println(i);
//        }
        do{
            j++;
            if (j==21){
                System.out.println("We are skipping 21");
                continue;
            }
            System.out.println(j);
        }while (j<=29);
    }
}